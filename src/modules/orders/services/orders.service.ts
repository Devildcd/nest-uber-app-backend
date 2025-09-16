import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
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
    private readonly dataSource: DataSource,
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

    try {
      return await this.dataSource.transaction(async (manager) => {
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

        /*   if (created) {
            this.events.emitOrderCreated(
              new OrderCreatedEvent({
                orderId: order.id,
                tripId,
                passengerId: dto.passengerId,
                driverId: dto.driverId,
                requestedAmount: amount,
                paymentType: PaymentType.CASH,
                currency: dto.currency ?? 'CUP',
                note: dto.note,
                createdAt: new Date().toISOString(),
              }),
            );
          }*/

        return { order, created, currency: dto.currency ?? 'CUP' };
      });
    } catch (error) {
      throw handleServiceError(
        this.logger,
        error,
        `TripPaymentsService.createCashOrderOnTripClosure ${tripId}`,
      );
    }
  }
  /**
   * Variante idempotente: si la Order ya estaba PAID, vuelve a aplicar
   * la comisión de forma idempotente y retorna alreadyPaid=true.
   */
  async confirmCashOrder(orderId: string, dto: ConfirmCashOrderDto) {
    const commission = toAmount(dto.commissionAmount);
    if (isNaN(commission)) {
      throw new BadRequestException(
        formatErrorResponse(
          'INVALID_COMMISSION_AMOUNT',
          'commissionAmount debe ser un decimal positivo.',
          { commissionAmount: dto.commissionAmount },
        ),
      );
    }
    const currency = (dto.currency ?? 'CUP').toUpperCase();
    try {
      return await this.dataSource.transaction(async (manager) => {
        // 1) Lock + cargar order con relaciones
        const order = await this.repo.loadAndLockOrder(manager, orderId);
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

        // 2) Cálculos financieros (mantén la comisión enviada; si tu negocio quiere tasa fija, cámbialo aquí)
        const gross = _roundTo2(Number(order.requestedAmount));
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
          orderId: order.id,
          tripId: order.trip.id,
          passengerId: order.passenger.id,
          driverId: order.driver.id,
          gross,
          commission,
          net,
          currency,
          description: 'trip charge (cash)',
        });

        // 4) Aplica comisión cash al wallet del driver (idempotente)
        //    (Crea/usa TX PLATFORM_COMMISSION y WalletMovement enlazado a esa TX)
        const applied = await this.walletsService.applyCashTripCommission(
          order.driver.id,
          {
            tripId: order.trip.id,
            commissionAmount: commission.toFixed(2),
            currency,
            grossAmount: gross.toFixed(2), // para KPI si lo usas
            note: dto.note ?? 'cash trip commission',
          } as any,
        );

        // 5) Marcar Order como PAID (idempotente). Si ya estaba, retorna igual.
        const alreadyPaid = order.status === 'paid';
        const updated = await this.repo.markPaid(
          manager,
          order,
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
          currency,
          commissionTransactionId: applied.tx.id, // PLATFORM_COMMISSION
          walletMovementId: applied.movement.id, // movimiento enlazado a PLATFORM_COMMISSION
          previousBalance: Number(applied.movement.previousBalance).toFixed(2),
          newBalance: Number(applied.movement.newBalance).toFixed(2),
          // Opcional: si quieres exponer el CHARGE en la respuesta, añade aquí:
          // chargeTransactionId: chargeTx.id,
          alreadyPaid,
        };
      });
    } catch (error) {
      throw handleServiceError(
        this.logger,
        error,
        `TripPaymentsService.confirmCashOrderIdempotent ${orderId}`,
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
}
