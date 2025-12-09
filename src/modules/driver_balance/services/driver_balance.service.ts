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
} from 'typeorm';
import { DriverBalanceDepositDto } from '../dto/update-driver-balance-deposit.dto';
import { DriverBalance } from '../entities/driver_balance.entity';
import { DriverBalanceRepository } from '../repositories/driver_balance.repository';
import { WalletMovement } from '../entities/wallet-movement.entity';
import { CashCollectionPoint } from '../../cash_colletions_points/entities/cash_colletions_points.entity';
import {
  CashCollectionRecord,
  CashCollectionStatus,
} from '../../cash_colletions_points/entities/cash_colletion_records.entity';
import { WalletMovementsRepository } from 'src/modules/driver_balance/repositories/wallet-movements.repository';
import { CashCollectionPointRepository } from '../../cash_colletions_points/repositories/cash_colletion_points.repository';
import { CashCollectionRecordRepository } from '../../cash_colletions_points/repositories/cash_colletion_records.repository';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../transactions/entities/transaction.entity';
import { TransactionRepository } from 'src/modules/transactions/repositories/transactions.repository';
import { CreateDriverBalanceDto } from '../dto/create-driver_balance.dto';
import {
  formatErrorResponse,
  formatSuccessResponse,
  handleServiceError,
} from 'src/common/utils/api-response.utils';
import { DriverBalanceResponseDto } from '../dto/driver-balance-response.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import { ApplyCashCommissionDto } from 'src/modules/transactions/dto/apply-cash-commission.dto';
import { DriverBalanceDataDto } from '../dto/driver-balance-data.dto';
import { _roundTo2 } from 'src/common/validators/decimal.transformer';
import { CreateCashTopupDto } from '../dto/create-cash-topup.dto';
import { ConfirmCashTopupDto } from '../dto/confirm-cash-topup.dto';
import { BlockDriverWalletDto } from '../dto/block-driver-wallet.dto';
import { UnblockDriverWalletDto } from '../dto/unblock-driver-wallet.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { WalletMovementQueryDto } from '../dto/wallet-movements-query.dto';

function toAmount(s: string): number {
  const n = Number(s);
  if (!isFinite(n) || n <= 0) return NaN;
  return Math.round(n * 100) / 100;
}

@Injectable()
export class DriverBalanceService {
  private readonly logger = new Logger(DriverBalanceService.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly repo: DriverBalanceRepository,
    private readonly movementRepo: WalletMovementsRepository,
    private readonly txRepo: TransactionRepository,
    private readonly pointRepo: CashCollectionPointRepository,
    private readonly recordRepo: CashCollectionRecordRepository,
  ) {}

  // MAPPERS//
  private toResponseDto(wallet: DriverBalance): DriverBalanceResponseDto {
    return {
      id: wallet.id,
      driverId: wallet.driverId,
      status: wallet.status,
      currency: wallet.currency,
      currentWalletBalance: wallet.currentWalletBalance,
      heldWalletBalance: wallet.heldWalletBalance,
      totalEarnedFromTrips: wallet.totalEarnedFromTrips,
      lastPayoutAt: wallet.lastPayoutAt ?? null,
      createdAt: wallet.createdAt,
      updatedAt: wallet.lastUpdated,
    };
  }

  async createOnboardingTx(
    driverId: string,
    manager: EntityManager,
    currency = 'CUP',
  ): Promise<DriverBalance> {
    // Usa el manager (misma TX) para consultar
    const existing = await manager.getRepository(DriverBalance).findOne({
      where: { driverId } as any,
    });
    if (existing) throw new ConflictException('El driver ya posee una wallet.');

    const partial: Partial<DriverBalance> = {
      driverId,
      currency,
      currentWalletBalance: 0,
      heldWalletBalance: 0,
      totalEarnedFromTrips: 0,
      minPayoutThreshold: 0,
      status: 'active',
    };

    return manager
      .getRepository(DriverBalance)
      .save(manager.getRepository(DriverBalance).create(partial));
  }

  /**
   * F3. Aplica la comisión de un viaje en efectivo (debitando el wallet del driver).
   * - Lock DriverBalance (FOR UPDATE)
   * - Rechaza si wallet.status === 'blocked'
   * - Crea Transaction(PLATFORM_COMMISSION, tripId) idempotente
   * - Crea WalletMovement (amount negativo) idempotente por transactionId
   * - Actualiza currentWalletBalance y  totalEarnedFromTrips
   * - Si cruza a negativo por primera vez => bloquea el wallet
   * - manager ES OBLIGATORIO (no abre transacción aquí)
   */
  async applyCashTripCommission(
    driverId: string,
    dto: ApplyCashCommissionDto,
    manager: EntityManager,
  ): Promise<{
    wallet: DriverBalance;
    movement: WalletMovement;
    tx: Transaction;
    eventsToEmit?: Array<{ name: string; payload: any }>;
  }> {
    // CHG-2: validación temprana y normalización de monto
    const commission = Number(dto.commissionAmount);
    if (!isFinite(commission) || commission <= 0) {
      throw new BadRequestException(
        formatErrorResponse<DriverBalanceDataDto>(
          'INVALID_COMMISSION_AMOUNT',
          'commissionAmount debe ser un decimal positivo.',
          { commissionAmount: dto.commissionAmount },
        ),
      );
    }

    // CHG-3: asegurar presencia de manager
    if (!manager) {
      throw new BadRequestException(
        formatErrorResponse(
          'MISSING_MANAGER',
          'Se requiere EntityManager de una transacción activa.',
          null,
        ),
      );
    }

    // CHG-4: LOCK pesimista del wallet usando SIEMPRE el manager provisto
    const wallet = await this.repo
      .lockByDriverId(manager, driverId)
      .catch(() => {
        throw new NotFoundException(
          formatErrorResponse(
            'WALLET_NOT_FOUND',
            'No existe wallet para el driver.',
            { driverId },
          ),
        );
      });

    // CHG-5: rechazar si bloqueado (regla de negocio)
    if (wallet.status === 'blocked') {
      throw new ConflictException(
        formatErrorResponse(
          'WALLET_BLOCKED',
          'La billetera está bloqueada. Se requiere top-up para continuar.',
          { driverId },
        ),
      );
    }

    // CHG-6: validar/normalizar moneda (uppercase) contra wallet.currency
    const currency = (dto.currency || wallet.currency).toUpperCase();
    if (currency !== wallet.currency) {
      throw new BadRequestException(
        formatErrorResponse(
          'CURRENCY_MISMATCH',
          'La moneda del movimiento no coincide con la moneda del wallet.',
          { walletCurrency: wallet.currency, currency },
        ),
      );
    }

    // CHG-7: crear/obtener TX PLATFORM_COMMISSION de forma idempotente usando el manager
    const tx = await this.txRepo.createPlatformCommission(manager, {
      driverId,
      tripId: dto.tripId,
      orderId: dto.orderId,
      amount: _roundTo2(commission),
      platformFee: Number(dto.platformFeeAmount),
      currency,
      description: dto.note ?? 'cash trip commission',
    });

    // CHG-8: idempotencia por movimiento -> si ya existe por transactionId, NO tocar saldo
    const existingMv = await manager.getRepository(WalletMovement).findOne({
      where: { transactionId: tx.id },
    });

    if (existingMv) {
      // CHG-9: devolver estado actual SIN recalcular ni sobreescribir el saldo
      const freshWallet = await manager
        .getRepository(DriverBalance)
        .findOneOrFail({
          where: { id: wallet.id },
        });
      return {
        wallet: freshWallet,
        movement: existingMv,
        tx,
        eventsToEmit: [],
      };
    }

    // CHG-10: calcular nuevo balance con util de redondeo consistente
    const previous = Number(wallet.currentWalletBalance);
    const amount = -_roundTo2(commission);
    const newBalance = _roundTo2(previous + amount);

    // CHG-11: crear WalletMovement usando RELACIÓN (no walletId)
    const mvRepo = manager.getRepository(WalletMovement);
    let movement: WalletMovement;
    try {
      const mv = mvRepo.create({
        wallet: { id: wallet.id } as any, // ManyToOne relation
        transactionId: tx.id,
        amount, // negativo
        previousBalance: previous,
        newBalance,
        note: dto.note ?? 'cash trip commission',
      });
      movement = await mvRepo.save(mv);
    } catch (err: any) {
      // CHG-12: si hubo carrera e insertó otro proceso (unique por transactionId), recuperar y continuar
      if (err?.code === '23505') {
        const already = await mvRepo.findOne({
          where: { transactionId: tx.id },
        });
        if (!already) throw err;
        movement = already;
      } else {
        throw err;
      }
    }

    // CHG-13: actualizar saldo y KPI en UNA sola operación (evita doble save y pisadas)
    if (dto.grossAmount != null) {
      const gross = Number(dto.grossAmount);
      if (!isFinite(gross) || gross < 0) {
        throw new BadRequestException(
          formatErrorResponse(
            'INVALID_GROSS_AMOUNT',
            'grossAmount debe ser un decimal >= 0.',
            {
              grossAmount: dto.grossAmount,
            },
          ),
        );
      }
      await manager.getRepository(DriverBalance).update(
        { id: wallet.id },
        {
          currentWalletBalance: newBalance,
          totalEarnedFromTrips: _roundTo2(
            Number(wallet.totalEarnedFromTrips) + _roundTo2(gross),
          ),
          lastUpdated: () => 'NOW()',
        },
      );
    } else {
      await manager.getRepository(DriverBalance).update(
        { id: wallet.id },
        {
          currentWalletBalance: newBalance,
          lastUpdated: () => 'NOW()',
        },
      );
    }

    const eventsToEmit: Array<{ name: string; payload: any }> = [
      {
        name: 'wallet.updated',
        payload: {
          driverId,
          previous,
          newBalance,
          at: new Date().toISOString(),
        },
      },
      {
        name: 'transaction.processed',
        payload: { transactionId: tx.id, driverId },
      },
    ];
    // CHG-14: si cruzó a negativo por primera vez, bloquear dentro de la misma TX
    if (newBalance < 0 && previous >= 0) {
      await this.repo.blockWalletLocked(
        manager,
        wallet,
        dto.note ?? 'negative_balance_on_commission',
      );
      eventsToEmit.push({
        name: 'wallet.blocked',
        payload: {
          driverId,
          reason: 'negative_balance_on_commission',
          at: new Date().toISOString(),
        },
      });
    }

    // CHG-15: devolver estado fresco del wallet (lectura con el mismo manager)
    const freshWallet = await manager
      .getRepository(DriverBalance)
      .findOneOrFail({
        where: { id: wallet.id },
      });

    return { wallet: freshWallet, movement, tx, eventsToEmit };
  }

  /**
   * Paso 1-3: valida punto activo, crea Transaction(WALLET_TOPUP, PENDING) y CCR(PENDING).
   */
  async createCashTopupPending(driverId: string, dto: CreateCashTopupDto) {
    const amount = toAmount(dto.amount);
    if (isNaN(amount)) {
      throw new BadRequestException(
        formatErrorResponse(
          'INVALID_AMOUNT',
          'El amount debe ser un decimal positivo.',
          { amount: dto.amount },
        ),
      );
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        // 1) Punto activo
        await this.pointRepo.mustBeActive(dto.collectionPointId);

        // 1.1) Wallet debe existir (aunque esté bloqueado se permite topup)
        const wallet = await this.repo.findByDriverId(driverId, manager);
        if (!wallet) {
          throw new NotFoundException(
            formatErrorResponse(
              'WALLET_NOT_FOUND',
              'No existe wallet para el driver.',
              { driverId },
            ),
          );
        }

        // 2) Moneda
        const currency = (dto.currency || wallet.currency).toUpperCase();
        if (currency !== wallet.currency) {
          throw new BadRequestException(
            formatErrorResponse(
              'CURRENCY_MISMATCH',
              'La moneda del topup no coincide con la del wallet.',
              { walletCurrency: wallet.currency, currency },
            ),
          );
        }

        // 3) Transaction PENDING
        const tx = await this.txRepo.createWalletTopupPending(manager, {
          driverId,
          amount,
          currency,
          description: dto.description ?? 'cash wallet topup',
          metadata: dto.metadata ?? undefined,
        });

        // 4) CCR PENDING (uq_ccr_transaction protege reintentos)
        const ccr = await this.recordRepo.createPending(manager, {
          driverId,
          collectionPointId: dto.collectionPointId,
          collectedByUserId: dto.collectedByUserId,
          amount,
          currency,
          transaction: tx,
          notes: dto.notes,
        });

        return { ccr, tx, currency, amount };
      });
    } catch (error) {
      throw handleServiceError(
        this.logger,
        error,
        'WalletsService.createCashTopupPending',
      );
    }
  }

  /**
   * Confirmación del CCR => aplica crédito al wallet y completa CCR.
   * - Idempotente: si CCR ya completed y movement existe, devuelve estado actual.
   * - Si wallet estaba blocked y newBalance >= 0 => unblockWalletLocked (se registra unblockedBy desde CCR.collectedByUserId si disponible).
   */
  async confirmCashTopup(
    ccrId: string,
    _dto: ConfirmCashTopupDto,
  ): Promise<{
    wallet: DriverBalance;
    movement: WalletMovement;
    ccrId: string;
    txId: string;
    amount: number;
    currency: string;
  }> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        // 1) Cargar CCR + tx + driver (y derivar driverId)
        const ccr = await this.recordRepo.findByIdWithTx(manager, ccrId);
        if (!ccr) {
          throw new NotFoundException(
            formatErrorResponse(
              'CCR_NOT_FOUND',
              'No existe el CashCollectionRecord.',
              { ccrId },
            ),
          );
        }
        const driverId = ccr.driver?.id;
        if (!driverId) {
          throw new NotFoundException(
            formatErrorResponse(
              'CCR_WITHOUT_DRIVER',
              'El CCR no tiene driver asociado.',
              { ccrId },
            ),
          );
        }

        const { transaction: tx } = ccr;
        if (!tx) {
          throw new NotFoundException(
            formatErrorResponse(
              'CCR_WITHOUT_TX',
              'El CCR no tiene transacción asociada.',
              { ccrId },
            ),
          );
        }

        // Idempotencia: si ya está completed, intenta leer movement y return
        if (ccr.status === CashCollectionStatus.COMPLETED) {
          const existingMv = await manager
            .getRepository(WalletMovement)
            .findOne({ where: { transactionId: tx.id } });
          if (!existingMv) {
            throw new BadRequestException(
              formatErrorResponse(
                'CCR_COMPLETED_NO_MOVEMENT',
                'CCR está completado pero no se encontró el movimiento asociado.',
                { ccrId, txId: tx.id },
              ),
            );
          }
          const freshWallet = await manager
            .getRepository(DriverBalance)
            .findOne({ where: { driverId } });
          return {
            wallet: freshWallet!,
            movement: existingMv,
            ccrId: ccr.id,
            txId: tx.id,
            amount: Number(ccr.amount),
            currency: ccr.currency,
          };
        }

        // 4.1) Lock del wallet
        const wallet = await this.repo.lockByDriverId(manager, driverId);

        // 4.2) Crear WalletMovement (amount positivo)
        const previous = _roundTo2(Number(wallet.currentWalletBalance));
        const credit = _roundTo2(Number(ccr.amount));
        const newBalance = _roundTo2(Number(previous + credit));

        // Idempotencia extra: si ya hay movement por esta tx, evitar duplicar
        const alreadyMv = await this.movementRepo.findByTransactionId(
          tx.id,
          manager,
        );
        if (alreadyMv) {
          if (String(ccr.status) !== String(CashCollectionStatus.COMPLETED)) {
            ccr.status = CashCollectionStatus.COMPLETED;
            await manager.getRepository(CashCollectionRecord).save(ccr);
          }
          await this.txRepo.markProcessed(manager, tx.id);

          return {
            wallet,
            movement: alreadyMv,
            ccrId: ccr.id,
            txId: tx.id,
            amount: credit,
            currency: ccr.currency,
          };
        }

        const movement = manager.getRepository(WalletMovement).create({
          wallet: { id: wallet.id } as any,
          transactionId: tx.id,
          amount: credit, // +amount
          previousBalance: previous,
          newBalance: newBalance,
          note: ccr.notes ?? 'cash topup confirmed',
        });
        await manager.getRepository(WalletMovement).save(movement);

        // 4.3) Actualizar saldo wallet (usa helper)
        await this.repo.updateBalanceLocked(manager, wallet, newBalance);

        // 4.4) Completar CCR + marcar transacción PROCESSED
        ccr.status = CashCollectionStatus.COMPLETED;
        await manager.getRepository(CashCollectionRecord).save(ccr);
        await this.txRepo.markProcessed(manager, tx.id);

        // 4.5) Si estaba bloqueada y ahora >= 0 => desbloquear (usamos collectedByUserId como performedBy si existe)
        if (wallet.status === 'blocked' && newBalance >= 0) {
          const performedBy = ccr.collectedBy.id ?? null;
          await this.repo.unblockWalletLocked(manager, wallet, performedBy);
          // Emitir wallet.unblocked post-commit (fuera de la tx)
        }

        return {
          wallet,
          movement,
          ccrId: ccr.id,
          txId: tx.id,
          amount: credit,
          currency: ccr.currency,
        };
      });
    } catch (error) {
      console.error(error);
      throw handleServiceError(
        this.logger,
        error,
        `WalletsService.confirmCashTopup (ccrId: ${ccrId})`,
      );
    }
  }
  /**
   * Bloquea el wallet (status='blocked').
   * Bloqueo manual: usa el método lock + blockLocked para setear blockedAt/blockedReason
   * Efecto de negocio: impedir payouts/egresos; permitir topups y ajustes de regularización.
   */
  async blockDriverWallet(
    driverId: string,
    dto: BlockDriverWalletDto,
  ): Promise<{
    driverId: string;
    previousStatus: 'active' | 'blocked';
    status: 'blocked';
    changed: boolean;
    changedAt: Date;
  }> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const wallet = await this.repo.lockByDriverId(manager, driverId);
        const previousStatus = wallet.status;
        const changedAt = new Date();

        // Si ya blocked -> idempotente
        if (wallet.status === 'blocked') {
          return {
            driverId,
            previousStatus,
            status: 'blocked' as const,
            changed: false,
            changedAt,
          };
        }

        const reason = (dto as any)?.reason ?? 'manual_block';
        await this.repo.blockWalletLocked(manager, wallet, reason);

        return {
          driverId,
          previousStatus,
          status: 'blocked' as const,
          changed: true,
          changedAt,
        };
      });
    } catch (error) {
      throw handleServiceError(
        this.logger,
        error,
        `WalletsService.blockDriverWallet (driverId: ${driverId})`,
      );
    }
  }

  /**
   * Desbloqueo manual: registra unblockedAt/unblockedBy si provided
   */
  async unblockDriverWallet(
    driverId: string,
    dto: UnblockDriverWalletDto,
  ): Promise<{
    driverId: string;
    previousStatus: 'active' | 'blocked';
    status: 'active';
    changed: boolean;
    changedAt: Date;
  }> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const wallet = await this.repo.lockByDriverId(manager, driverId);
        const previousStatus = wallet.status;
        const changedAt = new Date();

        if (wallet.status === 'active') {
          return {
            driverId,
            previousStatus,
            status: 'active' as const,
            changed: false,
            changedAt,
          };
        }

        const performedBy = (dto as any)?.performedBy ?? null;
        await this.repo.unblockWalletLocked(manager, wallet, performedBy);

        return {
          driverId,
          previousStatus,
          status: 'active' as const,
          changed: true,
          changedAt,
        };
      });
    } catch (error) {
      throw handleServiceError(
        this.logger,
        error,
        `WalletsService.unblockDriverWallet (driverId: ${driverId})`,
      );
    }
  }

  /** Obtener saldo de wallet por driverId (lectura simple, sin lock) */
  async getDriverWalletBalance(
    driverId: string,
  ): Promise<DriverBalanceResponseDto> {
    try {
      const wallet = await this.repo.getByDriverIdOrThrow(driverId);
      const data = this.toResponseDto(wallet);
      return data;
    } catch (error) {
      throw handleServiceError(
        this.logger,
        error,
        `DriverBalanceService.getDriverWalletBalance (driverId: ${driverId})`,
      );
    }
  }

  async findAllMovements(
    pagination: PaginationDto,
    walletId: string,
    filters?: WalletMovementQueryDto,
  ): Promise<ApiResponse<WalletMovement[]>> {
    try {
      // 1) Validar existencia de la wallet (usa manager si viene)
      const walletExists = await this.repo.findOne({
        where: { id: walletId },
      });
      if (!walletExists) {
        throw new NotFoundException(
          formatErrorResponse('WALLET_NOT_FOUND', 'No existe la wallet.', {
            walletId,
          }),
        );
      }
      const [items, total] = await this.movementRepo.findAllPaginated(
        pagination,
        walletId,
        filters,
      );
      return formatSuccessResponse<WalletMovement[]>(
        'Wallet movements retrieved successfully',
        items,
        { total, page: pagination.page ?? 1, limit: pagination.limit ?? 10 },
      );
    } catch (error: any) {
      this.logger.error(
        'findAll failed',
        (error instanceof Error ? error.stack : undefined) ||
          (typeof error === 'object' && 'message' in error
            ? (error as { message: string }).message
            : String(error)),
      );

      const typedError = error as {
        code?: string;
        message?: string;
        stack?: string;
      };

      return {
        ...formatErrorResponse<WalletMovement[]>(
          'Error fetching wallet movements',
          typedError.code,
          typedError,
        ),
        data: [],
      };
    }
  }
}
