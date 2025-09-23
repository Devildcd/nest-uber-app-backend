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

  async createDriverWalletOnboarding(
    dto: CreateDriverBalanceDto,
  ): Promise<ApiResponse<DriverBalanceResponseDto>> {
    try {
      const existing = await this.repo.findByDriverId(dto.driverId);
      if (existing) {
        throw new ConflictException('El driver ya posee un wallet.');
      }

      const partial: Partial<DriverBalance> = {
        driverId: dto.driverId,
        currency: dto.currency || 'CUP',
        currentWalletBalance: 0,
        status: 'active',
        heldWalletBalance: 0,
        totalEarnedFromTrips: 0,
        lastPayoutAt: undefined,
        minPayoutThreshold: 0,
      };
      const wallet = await this.repo.createAndSave(partial);
      const data = this.toResponseDto(wallet);
      return {
        data,
        message: 'Billetera de driver creada exitosamente.',
        success: true,
      };
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const pgErr = err.driverError as { code: string; detail?: string };
        if (pgErr.code === '23505') {
          return formatErrorResponse(
            'Resource conflict',
            'CONFLICT_ERROR',
            pgErr.detail,
          );
        }
      }
      if (err instanceof NotFoundException) {
        return formatErrorResponse(
          'Resource not found',
          'NOT_FOUND',
          err.message,
        );
      }
      if (err instanceof BadRequestException) {
        return formatErrorResponse(
          'Invalid request',
          'BAD_REQUEST',
          err.message,
        );
      }
      return handleServiceError<DriverBalanceResponseDto>(
        this.logger,
        err,
        'DriversService.create',
      );
    }
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
   * - Lock DriverBalance
   * - Rechaza si wallet.status === 'blocked'
   * - Crea Transaction(platform_commission, tripId)
   * - Crea WalletMovement (amount negativo)
   * - Actualiza currentWalletBalance (y opcionalmente totalEarnedFromTrips)
   * - Permite la primera operación que deje saldo < 0; después bloquea.
   * Idempotente por (type=platform_commission, tripId, driverId).
   */
  async applyCashTripCommission(
    driverId: string,
    dto: ApplyCashCommissionDto,
    manager?: EntityManager,
  ): Promise<{
    wallet: DriverBalance;
    movement: WalletMovement;
    tx: Transaction;
    eventsToEmit?: Array<{ name: string; payload: any }>;
  }> {
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

    // Helper que ejecuta todo usando el manager provisto
    const _do = async (mgr: EntityManager) => {
      // 1) Lock del wallet (FOR UPDATE) usando el mismo manager
      const wallet = await this.repo.lockByDriverId(driverId, mgr).catch(() => {
        throw new NotFoundException(
          formatErrorResponse(
            'WALLET_NOT_FOUND',
            'No existe wallet para el driver.',
            { driverId },
          ),
        );
      });

      // 1.1) Si está bloqueado, rechazamos
      if (wallet.status === 'blocked') {
        throw new ConflictException(
          formatErrorResponse(
            'WALLET_BLOCKED',
            'La billetera está bloqueada. Se requiere top-up para continuar.',
            { driverId },
          ),
        );
      }

      // 2) Validación de moneda
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

      // 3) Crear/obtener TRANSACTION PLATFORM_COMMISSION (idempotente) usando el mismo manager
      const tx = await this.txRepo.createPlatformCommission(mgr, {
        driverId,
        tripId: dto.tripId,
        amount: _roundTo2(commission),
        currency,
        description: dto.note ?? 'cash trip commission',
      });

      // 3.1) Comprobar si ya existe movimiento para tx (idempotencia)
      const existingMv = await mgr
        .getRepository(WalletMovement)
        .findOne({ where: { transactionId: tx.id } });

      if (existingMv) {
        // recargar wallet frescamente y devolver
        const freshWallet = await mgr
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

      // 4) Crear movimiento (amount negativo) y aplicar balance
      const previous = Number(wallet.currentWalletBalance);
      const amount = -_roundTo2(commission);
      const newBalance = _roundTo2(previous + amount);

      // Intentar insertar el movimiento; capturar unique-violation por transaction_id
      const mvRepo = mgr.getRepository(WalletMovement);
      let movement: WalletMovement;
      try {
        const mv = mvRepo.create({
          walletId: wallet.id,
          transactionId: tx.id,
          amount: amount, // negativo
          previousBalance: previous,
          newBalance: newBalance,
          note: dto.note ?? 'cash trip commission',
        } as DeepPartial<WalletMovement>);

        movement = await mvRepo.save(mv);
      } catch (err: any) {
        // Si otro proceso insertó al mismo tiempo -> 23505
        if (err?.code === '23505') {
          // recuperar el movimiento ya creado
          const already = await mvRepo.findOne({
            where: { transactionId: tx.id },
          });
          if (!already) throw err; // raro, rethrow si no lo encontramos
          movement = already;
        } else {
          throw err;
        }
      }

      // 5) Actualizar saldo del wallet (wallet está lockeado por lockByDriverId)
      await this.repo.updateBalanceLocked(mgr, wallet, newBalance);

      // 5b) (Opcional) KPI: sumar bruto
      if (dto.grossAmount) {
        const gross = Number(dto.grossAmount);
        if (!isFinite(gross) || gross < 0) {
          throw new BadRequestException(
            formatErrorResponse(
              'INVALID_GROSS_AMOUNT',
              'grossAmount debe ser un decimal >= 0.',
              { grossAmount: dto.grossAmount },
            ),
          );
        }
        wallet.totalEarnedFromTrips = _roundTo2(
          Number(wallet.totalEarnedFromTrips) + _roundTo2(gross),
        );
        await mgr.getRepository(DriverBalance).save(wallet);
      }

      // 6) Si pasó a negativo y antes era >= 0 -> bloquear (en la misma tx)
      if (newBalance < 0 && previous >= 0) {
        await this.repo.blockWalletLocked(
          mgr,
          wallet,
          dto.note ?? 'negative_balance_on_commission',
        );
        // NOTA: no emitimos eventos aquí; devolvemos eventsToEmit al caller para post-commit
      }

      const eventsToEmit = [
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

      return { wallet, movement, tx, eventsToEmit };
    }; // end _do

    // Si manager fue pasado por el caller, usamos ese manager (no nested tx).
    if (manager) {
      return _do(manager);
    }

    // Si no, abrimos una transacción propia
    try {
      return await this.dataSource.transaction(async (mgr) => {
        return _do(mgr);
      });
    } catch (error) {
      throw handleServiceError(
        this.logger,
        error,
        `WalletsService.applyCashTripCommission (driverId: ${driverId}, tripId: ${dto.tripId})`,
      );
    }
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
    driverId: string,
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
        // Cargar CCR + tx
        const ccr = await this.recordRepo.findByIdWithTx(manager, ccrId);
        if (!ccr || ccr.driver?.id !== driverId) {
          throw new NotFoundException(
            formatErrorResponse(
              'CCR_NOT_FOUND',
              'No existe el CashCollectionRecord para el driver.',
              { ccrId, driverId },
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
          const existingMv = await this.movementRepo.findByTransactionId(
            tx.id,
            manager,
          );
          if (!existingMv) {
            throw new BadRequestException(
              formatErrorResponse(
                'CCR_COMPLETED_NO_MOVEMENT',
                'CCR está completado pero no se encontró el movimiento asociado.',
                { ccrId, txId: tx.id },
              ),
            );
          }
          const freshWallet = await this.repo.findByDriverId(driverId, manager);
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
        const wallet = await this.repo.lockByDriverId(driverId, manager);

        // 4.2) Crear WalletMovement (amount positivo)
        const previous = Number(wallet.currentWalletBalance);
        const credit = Number(ccr.amount);
        const newBalance = Math.round((previous + credit) * 100) / 100;

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

          // actualizar wallet.balance si fuera necesario (pero no revertir bloqueos)
          wallet.currentWalletBalance = newBalance;
          await manager.getRepository(DriverBalance).save(wallet);

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
          walletId: wallet.id,
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
        `WalletsService.confirmCashTopup (driverId: ${driverId}, ccrId: ${ccrId})`,
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
        const wallet = await this.repo.lockByDriverId(driverId, manager);
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
        const wallet = await this.repo.lockByDriverId(driverId, manager);
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
}
