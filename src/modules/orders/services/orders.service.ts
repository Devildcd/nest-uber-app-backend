import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  QueryFailedError,
  QueryRunner,
} from 'typeorm';
import { OrderRepository } from '../repositories/order.repository';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { OrderFiltersDto } from '../dto/order-filters.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import {
  formatErrorResponse,
  formatSuccessResponse,
  handleServiceError,
} from 'src/common/utils/api-response.utils';
import { Order, OrderStatus, PaymentType } from '../entities/order.entity';
import { OrderListItemDto } from '../dto/order-list-item.dto';
import { OrderDetailDto } from '../dto/order-detail.dto';
import { Trip } from '../../trip/entities/trip.entity';
import { User } from '../../user/entities/user.entity';
import { ConfirmCashOrderDto } from '../dto/confirm-cash-order.dto';
import { TransactionRepository } from '../../transactions/repositories/transactions.repository';
import { DriverBalanceService } from 'src/modules/driver_balance/services/driver_balance.service';
import { _roundTo2 } from 'src/common/validators/decimal.transformer';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from 'src/modules/transactions/entities/transaction.entity';
import { DriverBalanceRepository } from 'src/modules/driver_balance/repositories/driver_balance.repository';
import { WalletMovementsRepository } from 'src/modules/driver_balance/repositories/wallet-movements.repository';
import { WalletMovement } from 'src/modules/driver_balance/entities/wallet-movement.entity';
import { CashCollectionRecord } from 'src/modules/cash_colletions_points/entities/cash_colletion_records.entity';
import { CashCollectionRecordRepository } from 'src/modules/cash_colletions_points/repositories/cash_colletion_records.repository';
import { AdjustCommissionDto } from '../dto/comission-adjustment.dto';
import { CommissionAdjustment } from '../entities/comission-adjustment.entity';
import { EventEmitter2 } from 'eventemitter2';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { DriverBalance } from 'src/modules/driver_balance/entities/driver_balance.entity';
import {
  OrderEventType,
  DomainEvent,
} from '../interfaces/order-event-types.enum';

const COMMISSION_RATE = 0.2; // 20% comisión plataforma

function toAmount(s: string): number {
  const n = Number(s);
  if (!isFinite(n) || n <= 0) return NaN;
  return Math.round(n * 100) / 100;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly repo: OrderRepository,
    private readonly txRepo: TransactionRepository,
    private readonly walletsService: DriverBalanceService,
    private readonly driverBalanceRepo: DriverBalanceRepository,
    private readonly movementRepo: WalletMovementsRepository,
    private readonly ccrRepo: CashCollectionRecordRepository,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Paso 1: Cierre de viaje => Generar Order(PENDING, CASH).
   * - Idempotente por trip_id (uq_orders_trip)
   * - Emite evento de dominio order.created SOLO si se creó.
   */
  async createCashOrderOnTripClosure(tripId: string, dto: CreateOrderDto) {
    const amount = toAmount(dto.requestedAmount);
    if (isNaN(amount)) {
      throw new BadRequestException(
        formatErrorResponse(
          'INVALID_REQUESTED_AMOUNT',
          'requestedAmount debe ser un decimal positivo.',
          { requestedAmount: dto.requestedAmount },
        ),
      );
    }
    // acumulador para eventos a emitir post-commit
    const postCommitEvents: Array<{ name: string; payload: any }> = [];

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const { order, created } = await this.repo.createPendingForTrip(
          manager,
          {
            tripId,
            passengerId: dto.passengerId,
            driverId: dto.driverId,
            requestedAmount: amount,
            paymentType: PaymentType.CASH,
          },
        );

        // CHG-EE-B: si se creó la orden en esta TX, construir evento AQUÍ
        if (created) {
          postCommitEvents.push({
            name: OrderEventType.CREATED,
            payload: {
              orderId: order.id,
              tripId,
              passengerId: dto.passengerId,
              driverId: dto.driverId,
              requestedAmount: amount,
              paymentType: PaymentType.CASH,
              currency: order.currency,
              createdAt: new Date().toISOString(),
            },
          });
        }

        return { order, created };
      });
      // post-commit: emitir eventos acumulados (si hay)
      try {
        for (const ev of postCommitEvents) {
          this.events.emit(ev.name, ev.payload);
          this.logger?.debug?.(
            `Post-commit event: ${ev.name} -> ${JSON.stringify(ev.payload)}`,
          );
        }
      } catch (emitErr) {
        this.logger?.error?.('Failed to emit post-commit events', emitErr);
      }

      return result;
    } catch (error) {
      throw handleServiceError(
        this.logger,
        error,
        `OrderService.createCashOrderOnTripClosure ${tripId}`,
      );
    }
  }

  /**
   * Paso 1 (TX): Crea (o reusa) la Order PENDING CASH al cerrar un Trip.
   * - Idempotente por trip_id (índice único en repo.createPendingForTrip)
   * - Deriva passengerId, driverId, requestedAmount y currency desde el Trip
   * - NO emite eventos aquí (el caller externo decide post-commit)
   */
  async createCashOrderOnTripClosureTx(
    manager: EntityManager,
    tripId: string,
    opts?: { currencyDefault?: string },
  ): Promise<{ order: Order; created: boolean }> {
    // 1) Leer trip
    const trip = await manager.getRepository(Trip).findOne({
      where: { id: tripId } as any,
      relations: { passenger: true, driver: true },
    });
    if (!trip) throw new NotFoundException(`Trip ${tripId} not found`);

    const passengerId = trip.passenger?.id ?? (trip as any).passengerId;
    const driverId = trip.driver?.id ?? (trip as any).driverId ?? null;
    if (!passengerId)
      throw new BadRequestException('Trip has no passenger linked');
    if (!driverId) throw new BadRequestException('Trip has no driver linked');

    // 2) Monto y moneda
    const rawFareTotal = trip.fareTotal;
    if (
      rawFareTotal == null ||
      isNaN(Number(rawFareTotal)) ||
      Number(rawFareTotal) <= 0
    ) {
      throw new BadRequestException(
        formatErrorResponse(
          'INVALID_REQUESTED_AMOUNT',
          'fare_total inválido o no calculado en el trip.',
          { tripId, fareTotal: rawFareTotal },
        ),
      );
    }
    const amount = toAmount(Number(rawFareTotal).toFixed(2));
    const currency = (
      trip.fareFinalCurrency ??
      opts?.currencyDefault ??
      'CUP'
    ).toUpperCase();

    // 3) Crear/obtener Order PENDING (idempotente por trip)
    const { order, created } = await this.repo.createPendingForTrip(manager, {
      tripId,
      passengerId,
      driverId,
      requestedAmount: amount,
      paymentType: PaymentType.CASH,
      // currency, // descomenta si tu repo lo soporta
    });

    // si tu repo no guarda currency, persístela allí mismo según tu implementación
    return { order, created };
  }

  /**
   * Variante idempotente: si la Order ya estaba PAID, vuelve a aplicar
   * la comisión de forma idempotente y retorna alreadyPaid=true.
   */
  async confirmCashOrder(orderId: string, dto: ConfirmCashOrderDto) {
    // acumulador para eventos que deben emitirse post-commit
    const postCommitEvents: Array<{ name: string; payload: any }> = [];
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        // 1) Lock + cargar order sin relaciones
        const order = await this.repo.loadAndLockOrder(orderId, manager);
        if (!order) {
          throw new NotFoundException(
            formatErrorResponse('ORDER_NOT_FOUND', 'Orden no encontrada.', {
              orderId,
            }),
          );
        }
        // 1.1) Asegura que sea flujo CASH
        if (order.paymentType !== PaymentType.CASH) {
          throw new BadRequestException(
            formatErrorResponse(
              'INVALID_PAYMENT_TYPE',
              'confirmCashOrderIdempotent procesa únicamente órdenes CASH.',
              { orderId, paymentType: order.paymentType },
            ),
          );
        }

        // 2) Cargar relaciones necesarias (trip, passenger, driver) usando findWithRelations con el mismo manager
        const fullOrder = await this.repo.findWithRelations(
          order.id,
          ['trip', 'passenger', 'driver'],
          undefined,
          manager,
        );
        if (!fullOrder) {
          // defensivo: debería ser raro porque loadAndLockOrder ya existía
          throw new NotFoundException(
            formatErrorResponse(
              'ORDER_NOT_FOUND',
              'Orden no encontrada tras lock.',
              { orderId },
            ),
          );
        }

        // 2) Cálculos financieros (calcula la comisión según jerarqía de commission_rate)
        const gross = _roundTo2(Number(fullOrder.requestedAmount));
        //2.1 Calcular la comisión aplicable (busca que COMMISSION_RATE aplcar según jerarquí
        // TO DO: 1. Campaign rate, 2. Driver plan rate, 3.	Global default
        const commission = gross * COMMISSION_RATE;
        const net = _roundTo2(gross - commission);
        if (net < 0) {
          throw new BadRequestException(
            formatErrorResponse(
              'NEGATIVE_NET',
              'La comisión no puede exceder el monto bruto.',
              { gross, commission, net },
            ),
          );
        }
        // 3) Crear/obtener TRANSACTION CHARGE (idempotente)
        const chargeTx = await this.txRepo.createOrGetChargeForOrder(manager, {
          orderId: fullOrder.id,
          tripId: fullOrder.trip.id,
          passengerId: fullOrder.passenger.id,
          driverId: fullOrder.driver.id,
          gross,
          commission,
          net,
          currency: fullOrder.currency ?? 'CUP',
          description: 'trip charge (cash)',
        });

        // 4) Aplica comisión cash al wallet del driver (idempotente)
        //    (Crea/usa TX PLATFORM_COMMISSION y WalletMovement enlazado a esa TX)
        const applied = await this.walletsService.applyCashTripCommission(
          fullOrder.driver.id,
          {
            tripId: fullOrder.trip.id,
            orderId: fullOrder.id,
            commissionAmount: commission.toFixed(2),
            platformFeeAmount: COMMISSION_RATE,
            currency: fullOrder.currency ?? 'CUP',
            grossAmount: gross.toFixed(2), // para KPI si lo usas
            note: 'cash trip commission',
          } as any,
          manager,
        );

        // collect post-commit events if wallet service returned any
        if ((applied as any)?.eventsToEmit) {
          postCommitEvents.push(...(applied as any).eventsToEmit);
        }

        // 5) Marcar Order como PAID (idempotente). Si ya estaba, retorna igual.
        const alreadyPaid = order.status === 'paid';
        const updated = await this.repo.markPaid(
          manager,
          fullOrder,
          dto.confirmedByUserId,
        );

        // 6) Respuesta (consolidada)
        return {
          orderId: updated.id,
          tripId: updated.trip.id,
          driverId: updated.driver.id,
          passengerId: updated.passenger.id,
          paymentType: updated.paymentType,
          status: updated.status,
          paidAt: (updated.paidAt ?? new Date()).toISOString(),
          confirmedBy: updated.confirmedBy!,
          commissionAmount: commission.toFixed(2),
          currency: updated.currency,
          commissionTransactionId: applied.tx.id, // PLATFORM_COMMISSION
          walletMovementId: applied.movement.id, // movimiento enlazado a PLATFORM_COMMISSION
          previousBalance: Number(applied.movement.previousBalance).toFixed(2),
          newBalance: Number(applied.movement.newBalance).toFixed(2),
          // Opcional: si quieres exponer el CHARGE en la respuesta, añade aquí:
          //chargeTransactionId: chargeTx.id,
          alreadyPaid,
        };
      });
      // post-commit: emitir eventos acumulados (si hay)
      try {
        if (postCommitEvents.length > 0) {
          for (const ev of postCommitEvents) {
            this.events.emit(ev.name, ev.payload);
            this.logger.debug(
              `Post-commit event: ${ev.name} -> ${JSON.stringify(ev.payload)}`,
            );
          }
        }
      } catch (emitErr) {
        this.logger.error('Failed to emit post-commit events', emitErr);
      }

      return result;
    } catch (error) {
      throw handleServiceError(
        this.logger,
        error,
        `OrderService.confirmCashOrder ${orderId}`,
      );
    }
  }

  // ------------------------------
  // FIND ALL (paginated)
  // ------------------------------
  async findAll(
    pagination: PaginationDto,
    filters?: OrderFiltersDto,
  ): Promise<ApiResponse<OrderListItemDto[]>> {
    try {
      const [items, total] = await this.repo.findAllPaginated(
        pagination,
        filters,
      );
      const mapped = (items ?? []).map((o) => this.toListItemDto(o));
      return formatSuccessResponse<OrderListItemDto[]>(
        'Orders retrieved successfully',
        mapped,
        { total, page: pagination.page ?? 1, limit: pagination.limit ?? 10 },
      );
    } catch (error: any) {
      this.logger.error(
        'findAll failed',
        error instanceof Error ? error.stack : String(error),
      );
      return formatErrorResponse<OrderListItemDto[]>(
        'Error fetching orders',
        'FIND_ALL_ERROR',
        error,
      );
    }
  }

  // ------------------------------
  // FIND BY ID (detail)
  // ------------------------------
  async findById(id: string): Promise<ApiResponse<OrderDetailDto>> {
    try {
      const order = await this.repo.findById(id);
      if (!order) {
        return formatErrorResponse<OrderDetailDto>(
          'Order not found',
          'NOT_FOUND',
        );
      }
      return formatSuccessResponse<OrderDetailDto>(
        'Order retrieved successfully',
        this.toDetailDto(order),
      );
    } catch (error: any) {
      this.logger.error(
        'findById failed',
        error instanceof Error ? error.stack : String(error),
      );
      return formatErrorResponse<OrderDetailDto>(
        'Error fetching order',
        'FIND_BY_ID_ERROR',
        error,
      );
    }
  }

  // ------------------------------
  // UPDATE (con transacción)
  // ------------------------------
  async update(
    id: string,
    dto: UpdateOrderDto,
  ): Promise<ApiResponse<OrderDetailDto>> {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await this.repo.findWithRelations(
        id,
        ['trip', 'passenger'],
        undefined,
        queryRunner.manager,
      );
      if (!existing) {
        throw new NotFoundException(`Order ${id} not found`);
      }

      // Si se desea reasignar trip/passenger aplicamos reglas de negocio:
      if ((dto as any).tripId !== undefined) {
        if (dto.tripId) {
          // validación: sólo permitir reasignar si la orden está en pending (recomendado)
          if (existing.status !== undefined && existing.status !== 'pending') {
            return formatErrorResponse<OrderDetailDto>(
              'Only pending orders can be reassigned',
              'INVALID_ORDER_STATE',
            );
          }
          const trip = await queryRunner.manager.findOne(Trip, {
            where: { id: dto.tripId },
          });
          if (!trip)
            throw new NotFoundException(`Trip ${dto.tripId} not found`);
          // check uniqueness for the new trip
          const other = await this.repo.findByTripId(
            dto.tripId,
            queryRunner.manager,
          );
          if (other && other.id !== existing.id) {
            return formatErrorResponse<OrderDetailDto>(
              'Another order exists for that trip',
              'TRIP_ORDER_CONFLICT',
            );
          }
          existing.trip = trip;
        } else {
          // set null? in our model trip is NOT NULL - disallow clearing
          return formatErrorResponse<OrderDetailDto>(
            'tripId cannot be null',
            'INVALID_PAYLOAD',
          );
        }
      }

      if ((dto as any).passengerId !== undefined) {
        if (dto.passengerId) {
          const passenger = await queryRunner.manager.findOne(User, {
            where: { id: dto.passengerId },
          });
          if (!passenger)
            throw new NotFoundException(
              `Passenger ${dto.passengerId} not found`,
            );
          existing.passenger = passenger;
        } else {
          return formatErrorResponse<OrderDetailDto>(
            'passengerId cannot be null',
            'INVALID_PAYLOAD',
          );
        }
      }

      // actualizar campos simples
      if (dto.requestedAmount !== undefined)
        existing.requestedAmount = dto.requestedAmount;
      if (dto.status !== undefined) {
        // si cambia a PAID -> podrías disparar conciliación o crear transaction
        existing.status = dto.status;
        // placeholder: si status === 'paid' -> handle capture / create Transaction, etc.
      }
      if (dto.paymentIntentId !== undefined)
        existing.paymentIntentId = dto.paymentIntentId;
      if (dto.paymentGatewayResponse !== undefined)
        existing.paymentGatewayResponse = dto.paymentGatewayResponse;
      if (dto.paymentMethodDetails !== undefined)
        existing.paymentMethodDetails = dto.paymentMethodDetails;
      if (dto.failureReason !== undefined)
        existing.failureReason = dto.failureReason;

      const updated = await queryRunner.manager.save(Order, existing);
      await queryRunner.commitTransaction();

      return formatSuccessResponse<OrderDetailDto>(
        'Order updated successfully',
        this.toDetailDto(updated),
      );
    } catch (error: any) {
      await queryRunner.rollbackTransaction();

      if (error instanceof QueryFailedError) {
        const pgErr = error.driverError as { code?: string; detail?: string };
        if (pgErr?.code === '23505') {
          return formatErrorResponse<OrderDetailDto>(
            'Resource conflict',
            'CONFLICT_ERROR',
            pgErr.detail,
          );
        }
      }

      if (error instanceof NotFoundException) {
        return formatErrorResponse<OrderDetailDto>(
          'Resource not found',
          'NOT_FOUND',
          error.message,
        );
      }

      if (error instanceof BadRequestException) {
        return formatErrorResponse<OrderDetailDto>(
          'Invalid request',
          'BAD_REQUEST',
          error.message,
        );
      }

      return handleServiceError<OrderDetailDto>(
        this.logger,
        error,
        'OrdersService.update',
      );
    } finally {
      await queryRunner.release();
    }
  }

  // ------------------------------
  // REMOVE (soft)
  // ------------------------------
  async remove(id: string): Promise<ApiResponse<null>> {
    try {
      await this.repo.softDeleteOrder(id);
      return formatSuccessResponse<null>('Order deleted successfully', null);
    } catch (err: any) {
      this.logger.error(
        'remove failed',
        err instanceof Error ? err.stack : String(err),
      );
      return formatErrorResponse<null>(
        'Error deleting order',
        'DELETE_ERROR',
        err,
      );
    }
  }
  /**
   * Process an immediate reversal (admin) for an order.
   * - One DB transaction.
   * - Precondition: Order.status === PAID and within policy window.
   * - Idempotent: only one REFUND transaction per order.
   * - Reverts platform commission to driver's wallet when applicable.
   *
   * Returns:
   *  - { forceNormalRefund: true } if outside immediate window (caller should trigger normal refund flow)
   *  - otherwise details with refundTxId and walletMovementId (if commission revert applied)
   */
  async processImmediateRefund(
    orderId: string,
    opts: {
      adminId: string;
      reason?: string;
      policyWindowMs?: number; // e.g. 15min in ms
    },
  ): Promise<{
    orderId: string;
    refundTxId?: string;
    walletMovementId?: string | null;
    reverted: boolean;
    forceNormalRefund?: boolean;
  }> {
    const policyWindowMs = opts.policyWindowMs ?? 15 * 60 * 1000; // default 15 minutes

    try {
      return await this.dataSource.transaction(async (manager) => {
        // 1) Lock order (FOR UPDATE)
        const order = await this.repo
          .loadAndLockOrder(orderId, manager)
          .catch(() => null);
        if (!order) {
          throw new NotFoundException(
            formatErrorResponse('ORDER_NOT_FOUND', 'Order not found', {
              orderId,
            }),
          );
        }

        // 2) Precondition: must be PAID
        if (order.status !== OrderStatus.PAID) {
          throw new BadRequestException(
            formatErrorResponse(
              'INVALID_ORDER_STATUS',
              'Order not in PAID state',
              { orderId, status: order.status },
            ),
          );
        }

        // 3) Policy window check
        const paidAtTs = order.paidAt ? new Date(order.paidAt).getTime() : 0;
        const now = Date.now();
        if (!paidAtTs || now - paidAtTs > policyWindowMs) {
          // outside immediate reversal window -> caller should run normal refund process
          return { orderId, reverted: false, forceNormalRefund: true };
        }

        // 4) Idempotency: check existing REFUND transaction for this order
        // txRepo.findRefundByOrderId should be implemented in your TransactionRepository
        const existingRefund = await this.txRepo.findRefundByOrderId(
          manager,
          orderId,
        );
        if (existingRefund) {
          // nothing to do (idempotent)
          return {
            orderId,
            refundTxId: existingRefund.id,
            walletMovementId: null,
            reverted: false,
          };
        }

        // 5) Create Transaction.REFUND (record contable)
        const refundAmount = _roundTo2(Number(order.requestedAmount ?? 0)); // gross amount to refund
        const currency = order.currency ?? 'CUP';

        // Cargar relaciones necesarias (trip, passenger, driver) usando findWithRelations con el mismo manager
        const fullOrder = await this.repo.findWithRelations(
          order.id,
          ['trip', 'passenger', 'driver'],
          undefined,
          manager,
        );
        if (!fullOrder || !fullOrder.driver?.id) {
          throw new NotFoundException(
            formatErrorResponse(
              'ORDER_RELATIONS_MISSING',
              'Order is missing essential relations (driver) required for refund processing.',
              { orderId, relations: ['driver'] },
            ),
          );
        }
        // Prefer using txRepo helper if available; otherwise create directly
        const refundTx = await this.txRepo.createRefund(manager, {
          orderId: fullOrder.id,
          fromUserId: fullOrder.driver.id,
          toUserId: fullOrder.passenger.id,
          tripId: fullOrder.trip.id,
          amount: refundAmount,
          platformFeeAmount: 0,
          currency: fullOrder.currency ?? 'CUP',
          description: `Immediate reversal for order ${order.id}`,
          metadata: {
            adminId: opts.adminId ?? null,
            reason: 'commission_revert',
          },
          status: TransactionStatus.PROCESSED,
        });

        // 7) Revert commission to driver wallet if applicable
        // Try to fetch the platform commission transaction for this order (txRepo helper recommended).
        let walletMovementId: string | null = null;
        try {
          // Try to find platform commission transaction for this order to know amount
          const platformCommissionTx =
            await this.txRepo.findPlatformCommissionByOrderId?.(
              manager,
              fullOrder.id,
            );
          const commissionAmount = platformCommissionTx
            ? _roundTo2(Number(platformCommissionTx.grossAmount ?? 0))
            : 0;

          if (fullOrder.driver && commissionAmount > 0) {
            // lock driver's wallet
            const wallet = await this.driverBalanceRepo
              .lockByDriverId(manager, fullOrder.driver.id)
              .catch(() => null);
            if (!wallet) {
              // If wallet not found, decide policy: here we throw (consistent with earlier flows)
              throw new NotFoundException(
                formatErrorResponse(
                  'WALLET_NOT_FOUND',
                  'Driver wallet not found for commission revert',
                  { driverId: fullOrder.driver.id },
                ),
              );
            }

            const prev = Number(wallet.currentWalletBalance ?? 0);
            const newBal = _roundTo2(prev + commissionAmount);

            // Create counter-transaction for driver (could be type BONUS or REFUND depending on model)
            const counterTx = await this.txRepo.createRefund(manager, {
              orderId: fullOrder.id,
              tripId: fullOrder.trip.id,
              toUserId: fullOrder.driver.id,
              amount: commissionAmount,
              currency,
              platformFeeAmount: 0,
              description: `Commission revert for order ${fullOrder.id} to driver ${fullOrder.driver.id}`,
              metadata: {
                adminId: opts.adminId ?? null,
                reason: 'commission_revert',
              },
              status: TransactionStatus.PROCESSED,
            });
            // Create WalletMovement (link to counterTx)
            // idempotency: check existing movement for this counterTx
            const existingMv = await this.movementRepo.findByTransactionId(
              counterTx.id,
              manager,
            );
            if (existingMv) {
              walletMovementId = existingMv.id;
            } else {
              const movement = manager.getRepository(WalletMovement).create({
                walletId: wallet.id,
                transactionId: counterTx.id,
                amount: commissionAmount, // credit to driver
                previousBalance: prev,
                newBalance: newBal,
                note: `Commission revert (order ${fullOrder.id})`,
              } as DeepPartial<WalletMovement>);
              const savedMv = await manager
                .getRepository(WalletMovement)
                .save(movement);

              // update wallet balance (helper)
              await this.driverBalanceRepo.updateBalanceLocked(
                manager,
                wallet,
                newBal,
              );

              walletMovementId = savedMv.id;
            }
          }
        } catch (err) {
          // If commission revert fails we rollback whole tx (so throw)
          throw handleServiceError(
            this.logger,
            err,
            `Commission revert fails:${orderId})`,
          );
        }

        // 8) Update Order: set status -> PENDING, clear paidAt/confirmedBy, add metadata note about reversal
        order.status = OrderStatus.PENDING;
        order.paidAt = undefined;
        order.confirmedBy = undefined;
        await manager.getRepository(Order).save(order);

        // 9) Return summary (events should be emitted by caller AFTER this transaction commits)
        return {
          orderId,
          refundTxId: refundTx.id,
          walletMovementId,
          reverted: true,
        };
      });
    } catch (err) {
      // Normalize & rethrow via your handler
      throw handleServiceError(
        this.logger,
        err,
        `OrderService.processImmediateRefund(orderId:${orderId})`,
      );
    }
  }
  /**
   * Normal refund process (CASH only, off-platform).
   *
   * Behaviour:
   *  - Runs inside a single DB transaction.
   *  - Locks the order (FOR UPDATE) via orderRepo.loadAndLockOrder.
   *  - Idempotent by order: if a REFUND tx already exists for the order, returns it.
   *  - Creates a REFUND Transaction (PROCESSED) and a CashCollectionRecord note for finance.
   *  - Reverts platform commission to driver wallet (creates counter REFUND tx + WalletMovement) when applicable.
   */
  async processNormalRefund(
    orderId: string,
    opts: {
      adminId: string;
      collectionPointId: string; // for CCR
      requestedBy?: string;
      reason?: string;
      amount?: number; // optional partial refund (business must allow)
      idempotencyKey?: string; // optional, not required for cash flow here
    },
  ): Promise<{
    orderId: string;
    refundTxId?: string;
    status?: 'processed' | 'pending' | 'failed';
    walletMovementId?: string | null;
    message?: string;
  }> {
    try {
      return await this.dataSource.transaction(
        async (manager: EntityManager) => {
          // 1) load & lock order (FOR UPDATE)
          const order = await this.repo
            .loadAndLockOrder(orderId, manager)
            .catch(() => null);
          if (!order) {
            throw new NotFoundException(
              formatErrorResponse('ORDER_NOT_FOUND', 'Order not found', {
                orderId,
              }),
            );
          }

          // 2) preconditions: only PAID orders
          if (
            order.status !== Order.prototype.status &&
            order.status !== OrderStatus.PAID
          ) {
            // support enum or literal check
            throw new BadRequestException(
              formatErrorResponse(
                'INVALID_ORDER_STATUS',
                'Order not in PAID state',
                { orderId, status: order.status },
              ),
            );
          }

          // 3) compute refund amount (full by default)
          const paidAmount = _roundTo2(Number(order.requestedAmount ?? 0));
          const requestedAmount = opts.amount
            ? _roundTo2(opts.amount)
            : paidAmount;

          if (requestedAmount <= 0 || requestedAmount > paidAmount) {
            throw new BadRequestException(
              formatErrorResponse(
                'INVALID_REFUND_AMOUNT',
                'Refund amount invalid',
                { paidAmount, requestedAmount },
              ),
            );
          }

          // 4) Idempotency by order: if REFUND exists for this order, return it (idempotent)
          const existingRefund = await this.txRepo.findRefundByOrderId(
            manager,
            orderId,
          );
          if (existingRefund) {
            return {
              orderId,
              refundTxId: existingRefund.id,
              status:
                existingRefund.status === TransactionStatus.PROCESSED
                  ? 'processed'
                  : 'pending',
              walletMovementId: null,
              message: 'Idempotent: existing refund found for order',
            };
          }

          // 2) Cargar relaciones necesarias (trip, passenger, driver) usando findWithRelations con el mismo manager
          const fullOrder = await this.repo.findWithRelations(
            order.id,
            ['trip', 'passenger', 'driver'],
            undefined,
            manager,
          );
          if (!fullOrder) {
            // defensivo: debería ser raro porque loadAndLockOrder ya existía
            throw new NotFoundException(
              formatErrorResponse(
                'ORDER_NOT_FOUND',
                'Orden no encontrada tras lock.',
                { orderId },
              ),
            );
          }

          // 5) Create REFUND transaction (mark as PROCESSED for cash/off-platform accounting)
          const refundTx = await this.txRepo.createRefund(manager, {
            orderId: fullOrder.id,
            fromUserId: fullOrder.driver?.id ?? null,
            tripId: fullOrder.trip.id,
            toUserId: fullOrder.passenger.id,
            amount: requestedAmount,
            platformFeeAmount: 0, // no platform fee on refunds
            currency: fullOrder.currency ?? 'CUP',
            description: `Cash refund (off-platform) for order ${fullOrder.id}`,
            metadata: {
              adminId: opts.adminId ?? opts.requestedBy ?? null,
              reason: opts.reason ?? 'cash_off_platform_refund',
              idempotencyKey: opts.idempotencyKey ?? null,
            },
            status: TransactionStatus.PROCESSED,
          });

          // 6) Create CashCollectionRecord note (info for finance / off-platform payout)
          await this.ccrRepo.createOffPlatformRefundNote(manager, {
            orderId: fullOrder.id,
            transactionId: refundTx.id,
            collectionPointId: opts.collectionPointId,
            driverId: fullOrder.driver?.id ?? null,
            adminId: opts.adminId ?? opts.requestedBy ?? 'system',
            note: opts.reason ?? 'cash refund (off-platform)',
            currency: fullOrder.currency ?? 'CUP',
          });

          // 7) Revert commission to driver if applicable
          let walletMovementId: string | null = null;
          try {
            const platformCommissionTx =
              await this.txRepo.findPlatformCommissionByOrderId(
                manager,
                fullOrder.id,
              );
            const commissionAmount = platformCommissionTx
              ? _roundTo2(Number(platformCommissionTx.grossAmount ?? 0))
              : _roundTo2(Number((order as any).platformCommissionAmount ?? 0));

            if (fullOrder.driver && commissionAmount > 0) {
              // lock driver wallet row
              const wallet = await this.driverBalanceRepo
                .lockByDriverId(manager, fullOrder.driver.id)
                .catch(() => null);
              if (!wallet) {
                throw new NotFoundException(
                  formatErrorResponse(
                    'WALLET_NOT_FOUND',
                    'Driver wallet not found for commission revert',
                    { driverId: fullOrder.driver.id },
                  ),
                );
              }

              const prev = Number(wallet.currentWalletBalance ?? 0);
              const newBal = _roundTo2(prev + commissionAmount);

              // create counter transaction for driver (REFUND / compensation) and mark PROCESSED
              const counterTx = await this.txRepo.createRefund(manager, {
                orderId: fullOrder.id,
                toUserId: fullOrder.driver.id,
                tripId: fullOrder.trip.id,
                amount: commissionAmount,
                platformFeeAmount: 0,
                currency: fullOrder.currency ?? 'CUP',
                description: `Commission revert for order ${fullOrder.id}`,
                metadata: {
                  adminId: opts.adminId ?? null,
                  reason: 'commission_revert',
                },
                status: TransactionStatus.PROCESSED,
              });

              // idempotency: check existing movement for this transaction
              const existingMv = await this.movementRepo.findByTransactionId(
                counterTx.id,
                manager,
              );
              if (existingMv) {
                walletMovementId = existingMv.id;
              } else {
                // create wallet movement (use movementRepo helper if available)
                const mv = await this.movementRepo.createAndSave(manager, {
                  walletId: wallet.id,
                  transactionId: counterTx.id,
                  amount: commissionAmount,
                  previousBalance: prev,
                  newBalance: newBal,
                  note: `Commission revert (order ${fullOrder.id})`,
                } as any);
                walletMovementId = mv.id;

                // update wallet balance
                wallet.currentWalletBalance = newBal;
                await manager.getRepository(DriverBalance).save(wallet);
              }
            }
          } catch (err) {
            // rollback transaction if commission revert fails
            throw handleServiceError(
              this.logger,
              err,
              `Commission revert fails:${orderId})`,
            );
          }

          // 8) Update Order: set to REFUNDED and add refund metadata
          fullOrder.status = OrderStatus.REFUNDED;
          (fullOrder as any).updatedAt = new Date();
          fullOrder.metadata = {
            ...(fullOrder.metadata ?? {}),
            lastRefund: {
              adminId: opts.adminId ?? opts.requestedBy ?? null,
              at: new Date().toISOString(),
              amount: requestedAmount,
              refundTxId: refundTx.id,
              status: 'processed',
            },
          };

          await manager.getRepository(Order).save(fullOrder);

          // 9) Return summary; events/notifications should be emitted post-commit by caller
          return {
            orderId,
            refundTxId: refundTx.id,
            status: 'processed' as const,
            walletMovementId,
            message:
              'Cash refund recorded; finance notified via CCR; commission reverted to driver if applicable.',
          };
        },
      );
    } catch (err) {
      throw handleServiceError(
        this.logger,
        err,
        `OrderService.processNormalRefund(orderId:${orderId})`,
      );
    }
  }

  /**
   * Ajuste de comisión post-facto idempotente.
   * - idempotencia por (orderId, adjustmentSeq) persistida en table commission_adjustments.
   * - Una única transacción SERIALIZABLE con locks (order read lock, wallet write lock).
   * - Crea Transaction (PENALTY/BONUS), WalletMovement y actualiza DriverBalance.
   *
   * Retorna snapshot con detalles del ajuste.
   */
  async adjustCommission(orderId: string, dto: AdjustCommissionDto) {
    try {
      const eventsToEmit: Array<{ name: string; payload: any }> = [];

      const result = await this.dataSource.transaction(
        'SERIALIZABLE',
        async (manager: EntityManager) => {
          // 1) Cargar order con lock de lectura (usa tu repo para consistencia)
          const order = await this.repo.loadAndLockOrder(orderId, manager);
          if (!order) {
            throw new NotFoundException(
              formatErrorResponse('ORDER_NOT_FOUND', 'Order not found', {
                orderId,
              }),
            );
          }

          if (order.status !== OrderStatus.PAID) {
            throw new BadRequestException(
              formatErrorResponse(
                'INVALID_ORDER_STATUS',
                'Order must be PAID to apply commission adjustment',
                { orderId, status: order.status },
              ),
            );
          }

          // 2) Idempotencia: comprobar commission_adjustments
          const caRepo = manager.getRepository(CommissionAdjustment);
          const existingAdj = await caRepo.findOne({
            where: {
              order: { id: orderId } as any,
              adjustmentSeq: dto.adjustmentSeq,
            },
            relations: ['order'],
          });
          if (existingAdj) {
            const createdAt = existingAdj.createdAt;
            return {
              adjustmentId: existingAdj.id,
              adjustmentSeq: existingAdj.adjustmentSeq,
              deltaApplied: Number(existingAdj.deltaFee),
              originalFee: Number(existingAdj.originalFee),
              newFee: Number(existingAdj.newFee),
              wallet: { prevBalance: null, newBalance: null },
              transactionId: null,
              movementId: null,
              alreadyExisted: true,
              createdAt,
              updatedAt: createdAt,
            } as any;
          }

          // 3) Obtener comisión original (según método de pago) usando TransactionRepository helpers
          let originalFee = 0;
          if (order.paymentType === PaymentType.CASH) {
            originalFee =
              await this.txRepo.getOriginalFeeFromPlatformCommission(
                manager,
                order.id,
              );
          } else {
            originalFee = await this.txRepo.getOriginalFeeFromCharge(
              manager,
              order.id,
            );
          }
          originalFee = _roundTo2(Number(originalFee ?? 0));

          // 4) Calcular delta
          let delta = NaN;
          if (dto.deltaFee !== undefined && dto.deltaFee !== null) {
            delta = _roundTo2(Number(dto.deltaFee));
          } else if (dto.newFee !== undefined && dto.newFee !== null) {
            delta = _roundTo2(Number(dto.newFee) - originalFee);
          } else {
            throw new BadRequestException(
              formatErrorResponse(
                'INVALID_PAYLOAD',
                'Either deltaFee or newFee must be provided',
                {},
              ),
            );
          }

          if (!isFinite(delta)) {
            throw new BadRequestException(
              formatErrorResponse(
                'INVALID_DELTA',
                'Computed delta is not a finite number',
                {},
              ),
            );
          }

          if (
            dto.maxAbsDeltaAllowed !== undefined &&
            Math.abs(delta) > dto.maxAbsDeltaAllowed
          ) {
            throw new BadRequestException(
              formatErrorResponse(
                'DELTA_EXCEEDS_THRESHOLD',
                'Delta exceeds allowed threshold',
                { delta, max: dto.maxAbsDeltaAllowed },
              ),
            );
          }

          // 4b) Si delta === 0: crear un registro de traza (idempotencia) y devolver no-op
          if (_roundTo2(delta) === 0) {
            try {
              const adj0 = caRepo.create({
                order: { id: order.id } as any,
                adjustmentSeq: dto.adjustmentSeq,
                deltaFee: 0,
                originalFee,
                newFee: originalFee,
                reason: dto.reason ?? null,
              } as DeepPartial<CommissionAdjustment>);
              const saved0 = await caRepo.save(adj0);
              const createdAt = saved0.createdAt;
              return {
                adjustmentId: saved0.id,
                transactionId: null,
                movementId: null,
                wallet: { prevBalance: null, newBalance: null },
                alreadyExisted: false,
                createdAt,
                updatedAt: createdAt,
              };
            } catch (err: any) {
              // race condition: si violación unique (23505) -> recuperar existente y devolver
              if (
                err instanceof QueryFailedError &&
                (err as any).code === '23505'
              ) {
                const exist = await caRepo.findOne({
                  where: {
                    order: { id: orderId } as any,
                    adjustmentSeq: dto.adjustmentSeq,
                  },
                });
                if (exist) {
                  const createdAt = exist.createdAt;
                  return {
                    adjustmentId: exist.id,
                    transactionId: null,
                    movementId: null,
                    wallet: { prevBalance: null, newBalance: null },
                    alreadyExisted: true,
                    createdAt,
                    updatedAt: createdAt,
                  } as any;
                }
              }
              throw err;
            }
          }

          const fullOrder = await this.repo.findWithRelations(
            order.id,
            ['trip', 'passenger', 'driver'],
            undefined,
            manager,
          );
          if (!fullOrder) {
            // defensivo: debería ser raro porque loadAndLockOrder ya existía
            throw new NotFoundException(
              formatErrorResponse(
                'ORDER_NOT_FOUND',
                'Orden no encontrada tras lock.',
                { orderId },
              ),
            );
          }

          // 5) Construcción de la transacción contable (PENALTY si delta>0, BONUS si delta<0)
          const isPenalty = delta > 0;
          const absDelta = Math.abs(delta);
          const now = new Date();

          const txRepo = manager.getRepository(Transaction);
          const tx = txRepo.create({
            type: isPenalty ? TransactionType.PENALTY : TransactionType.BONUS,
            order: { id: fullOrder.id } as any,
            trip: fullOrder.trip ? ({ id: fullOrder.trip.id } as any) : null,
            fromUser: isPenalty
              ? ({ id: fullOrder.driver?.id } as any)
              : undefined,
            toUser: !isPenalty
              ? ({ id: fullOrder.driver?.id } as any)
              : undefined,
            grossAmount: _roundTo2(absDelta),
            platformFeeAmount: 0,
            netAmount: _roundTo2(isPenalty ? -absDelta : absDelta),
            currency: order.currency ?? 'CUP',
            status: TransactionStatus.PROCESSED,
            processedAt: now,
            description: isPenalty
              ? 'Ajuste de comisión (penalización post-facto)'
              : 'Ajuste de comisión (bonificación post-facto)',
            metadata: {
              adjustmentSeq: dto.adjustmentSeq,
              reason: dto.reason ?? null,
              originalFee,
              newFee: _roundTo2(originalFee + delta),
              source: 'commission_adjustment',
            } as any,
          } as DeepPartial<Transaction>);

          const savedTx = await txRepo.save(tx);

          // 6) Reflejar en wallet del driver (lock pessimistic_write)
          // Uso de driverBalanceRepo.lockByDriverId(manager, driverId) si tu repo lo expone (parece que sí)
          const wallet = await this.driverBalanceRepo
            .lockByDriverId(manager, fullOrder.driver.id)
            .catch(() => null);
          if (!wallet) {
            throw new NotFoundException(
              formatErrorResponse(
                'WALLET_NOT_FOUND',
                'Driver wallet not found',
                { driverId: fullOrder.driver.id },
              ),
            );
          }
          if ((wallet as any).status === 'blocked') {
            throw new BadRequestException(
              formatErrorResponse(
                'WALLET_BLOCKED',
                'Driver wallet is blocked',
                { driverId: fullOrder.driver.id },
              ),
            );
          }

          const prevBal = _roundTo2(
            Number((wallet as any).currentWalletBalance ?? 0),
          );
          const newBal = _roundTo2(
            prevBal + (isPenalty ? -absDelta : absDelta),
          );

          // Update wallet balance (use repo helper if available)
          await (this.driverBalanceRepo as any).updateBalanceLocked(
            manager,
            wallet,
            newBal,
          );

          // 7) Crear WalletMovement (idempotencia por transactionId)
          // si movementRepo tiene createAndSave(manager, ...), úsala; si no, guardamos directo
          let movementSaved: WalletMovement;
          movementSaved = await (this.movementRepo as any).createAndSave(
            manager,
            {
              walletId: wallet.id,
              transactionId: savedTx.id,
              amount: isPenalty ? -absDelta : absDelta,
              previousBalance: prevBal,
              newBalance: newBal,
              note: isPenalty
                ? `Penalización por ajuste de comisión (seq=${dto.adjustmentSeq})`
                : `Bonificación por ajuste de comisión (seq=${dto.adjustmentSeq})`,
            },
          );

          // 8) Registrar snapshot idempotencia en commission_adjustments (manejar 23505 por carreras)
          try {
            const adj = caRepo.create({
              order: { id: fullOrder.id } as any,
              adjustmentSeq: dto.adjustmentSeq,
              deltaFee: _roundTo2(delta),
              originalFee,
              newFee: _roundTo2(originalFee + delta),
              reason: dto.reason ?? null,
            } as DeepPartial<CommissionAdjustment>);
            const savedAdj = await caRepo.save(adj);

            // 9) Preparar events para emitir post-commit (si tienes un emitter, aquí los acumulamos)
            eventsToEmit.push({
              name: 'wallet.updated',
              payload: {
                driverId: fullOrder.driver.id,
                balance: newBal,
                at: now.toISOString(),
              },
            });
            eventsToEmit.push({
              name: 'transaction.processed',
              payload: { transactionId: savedTx.id, orderId: fullOrder.id },
            });

            const createdAt = savedAdj.createdAt;
            return {
              orderId: fullOrder.id,
              adjustmentSeq: savedAdj.adjustmentSeq,
              deltaApplied: _roundTo2(delta),
              originalFee,
              newFee: _roundTo2(originalFee + delta),
              adjustmentId: savedAdj.id,
              transactionId: savedTx.id,
              movementId: movementSaved.id,
              wallet: { prevBalance: prevBal, newBalance: newBal },
              alreadyExisted: false,
              createdAt,
              updatedAt: createdAt,
            } as any;
          } catch (err: any) {
            if (
              err instanceof QueryFailedError &&
              (err as any).code === '23505'
            ) {
              // race: otro proceso insertó el commission_adjustment; recuperar y devolver
              const exist = await caRepo.findOne({
                where: {
                  order: { id: orderId } as any,
                  adjustmentSeq: dto.adjustmentSeq,
                },
              });
              if (exist) {
                return {
                  orderId: fullOrder.id,
                  adjustmentId: exist.id,
                  adjustmentSeq: exist.adjustmentSeq,
                  deltaApplied: Number(exist.deltaFee),
                  originalFee: Number(exist.originalFee),
                  newFee: Number(exist.newFee),
                  wallet: { previous: prevBal, current: newBal },
                  transactionId: savedTx.id,
                  movementId: movementSaved.id,
                  alreadyExisted: true,
                };
              }
            }
            throw err;
          }
        },
      ); // end transaction

      try {
        // example: this.events.emit(...) if you have it
        if ((eventsToEmit?.length ?? 0) > 0) {
          this.emitPostCommitEvents(eventsToEmit);
        }
      } catch (err) {
        this.logger.error('Failed to emit post-commit events', err);
      }

      return result;
    } catch (err) {
      throw handleServiceError(
        this.logger,
        err,
        `OrdersService.adjustCommission(orderId:${orderId})`,
      );
    }
  }
  // ------------------------------
  // MAPPERS
  // ------------------------------
  private toListItemDto(order: Order): OrderListItemDto {
    return {
      id: order.id,
      tripId: order.trip?.id ?? undefined,
      passengerId: order.passenger?.id ?? undefined,
      requestedAmount: order.requestedAmount,
      status: order.status,
      createdAt: order.createdAt?.toISOString(),
      updatedAt: order.updatedAt?.toISOString(),
    };
  }

  private toDetailDto(order: Order): OrderDetailDto {
    return {
      id: order.id,
      tripId: order.trip?.id ?? undefined,
      passengerId: order.passenger?.id ?? undefined,
      driverId: order.driver?.id ?? undefined,
      confirmedBy: order.confirmedBy ?? undefined,
      paymentType: order.paymentType ?? undefined,
      paidAt: order.paidAt ? order.paidAt.toISOString() : undefined,
      requestedAmount: order.requestedAmount,
      status: order.status,
      paymentIntentId: order.paymentIntentId ?? undefined,
      paymentGatewayResponse: order.paymentGatewayResponse ?? undefined,
      paymentMethodDetails: order.paymentMethodDetails ?? undefined,
      failureReason: order.failureReason ?? undefined,
      createdAt: order.createdAt?.toISOString(),
      updatedAt: order.updatedAt?.toISOString(),
      deletedAt: order.deletedAt ? order.deletedAt.toISOString() : undefined,
    };
  }

  private emitPostCommitEvents(eventsToEmit: DomainEvent[]) {
    if (!eventsToEmit?.length) return;

    try {
      for (const ev of eventsToEmit) {
        // emite cada evento
        this.events.emit(ev.name, ev.payload);
        // log por evento
        this.logger.debug(
          `Post-commit event emitted: ${ev.name} -> ${JSON.stringify(ev.payload)}`,
        );
      }

      // log resumen
      this.logger.debug(
        `Post-commit events: ${JSON.stringify(
          eventsToEmit.map((e) => ({ name: e.name })),
        )}`,
      );
    } catch (err) {
      this.logger.error('Failed to emit post-commit events', err);
    }
  }
}
