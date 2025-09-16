import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { DriverBalanceDepositDto } from '../dto/update-driver-balance-deposit.dto';
import { DriverBalance } from '../entities/driver_balance.entity';
import { DriverBalanceRepository } from '../repositories/driver_balance.repository';
import { WalletMovement } from '../../wallet-movements/entities/wallet-movement.entity';
import { CashCollectionPoint } from '../../cash_colletions_points/entities/cash_colletions_points.entity';
import {
  CashCollectionRecord,
  CashCollectionStatus,
} from '../../cash_colletion_records/entities/cash_colletion_records.entity';
import { WalletMovementsRepository } from 'src/modules/wallet-movements/repositories/wallet-movements.repository';
import { CashCollectionPointRepository } from '../../cash_colletions_points/repositories/cash_colletion_points.repository';
import { CashCollectionRecordRepository } from '../../cash_colletion_records/repositories/cash_colletion_records.repository';
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
  /**
   * F3. Aplica la comisión de un viaje en efectivo (debitando el wallet del driver).
   * - Lock DriverBalance
   * - Crea Transaction(platform_commission, tripId)
   * - Crea WalletMovement (amount negativo)
   * - Actualiza currentWalletBalance (y opcionalmente totalEarnedFromTrips)
   * Idempotente por (type=platform_commission, tripId, driverId).
   */
  async applyCashTripCommission(
    driverId: string,
    dto: ApplyCashCommissionDto,
  ): Promise<{
    wallet: DriverBalance;
    movement: WalletMovement;
    tx: Transaction;
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

    try {
      return await this.dataSource.transaction(async (manager) => {
        // 1) Lock del wallet
        const wallet = await this.repo
          .lockByDriverId(driverId, manager)
          .catch(() => {
            throw new NotFoundException(
              formatErrorResponse(
                'WALLET_NOT_FOUND',
                'No existe wallet para el driver.',
                { driverId },
              ),
            );
          });

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

        // 3) Transaction idempotente
        const tx = await this.txRepo.createPlatformCommission(manager, {
          driverId,
          tripId: dto.tripId,
          amount: _roundTo2(commission),
          currency,
          description: dto.note ?? 'cash trip commission',
        });

        // 3.1) Si ya existía y ya tenía movimiento, devolvemos idempotente
        const existingMv = await manager
          .getRepository(WalletMovement)
          .findOne({ where: { transactionId: tx.id } });

        if (existingMv) {
          // Recargar wallet (balance ya aplicado previamente)
          const freshWallet = await manager
            .getRepository(DriverBalance)
            .findOneOrFail({
              where: { id: wallet.id },
            });
          return { wallet: freshWallet, movement: existingMv, tx };
        }

        // 4) Crear movimiento (amount negativo)
        const previous = Number(wallet.currentWalletBalance);
        const amount = -_roundTo2(commission);
        const newBalance = _roundTo2(previous + amount);

        const movement = manager.getRepository(WalletMovement).create({
          walletId: wallet.id,
          transactionId: tx.id,
          amount: amount, // negativo
          previousBalance: previous,
          newBalance: newBalance,
          note: dto.note ?? 'cash trip commission',
        });
        await manager.getRepository(WalletMovement).save(movement);

        // 5) Actualizar saldos del wallet
        wallet.currentWalletBalance = newBalance;

        // (Opcional) KPI: sumar bruto
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
        }

        await manager.getRepository(DriverBalance).save(wallet);

        return { wallet, movement, tx };
      });
    } catch (error) {
      throw handleServiceError(
        this.logger, // or your logger instance
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
        const wallet = await this.repo.findByDriverId(driverId);
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
   * Paso 4: Confirmación del CCR => aplica crédito al wallet y completa CCR.
   * Idempotente: si CCR ya estaba completed y hay movement, devuelve estado actual.
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
          const existingMv = await this.movementRepo.findByTransactionId(tx.id);
          if (!existingMv) {
            // Estado inconsistente: CCR completed sin movimiento; NO aplicar de nuevo, reportar
            throw new BadRequestException(
              formatErrorResponse(
                'CCR_COMPLETED_NO_MOVEMENT',
                'CCR está completado pero no se encontró el movimiento asociado.',
                { ccrId, txId: tx.id },
              ),
            );
          }
          const freshWallet = await this.repo.findByDriverId(driverId);
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
        const alreadyMv = await this.movementRepo.findByTransactionId(tx.id);
        if (alreadyMv) {
          // Completar CCR si aún no lo está, y salir
          if (String(ccr.status) !== String(CashCollectionStatus.COMPLETED)) {
            ccr.status = CashCollectionStatus.COMPLETED;
            await manager.getRepository(CashCollectionRecord).save(ccr);
          }
          // Asegurar tx PROCESSED
          await this.txRepo.markProcessed(manager, tx.id);

          wallet.currentWalletBalance = newBalance; // opcional: recargar desde DB si aplica
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

        // 4.3) Actualizar saldo wallet
        wallet.currentWalletBalance = newBalance;
        await manager.getRepository(DriverBalance).save(wallet);

        // 4.4) Completar CCR + marcar transacción PROCESSED
        ccr.status = CashCollectionStatus.COMPLETED;
        await manager.getRepository(CashCollectionRecord).save(ccr);
        await this.txRepo.markProcessed(manager, tx.id);

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
      throw handleServiceError(
        this.logger,
        error,
        `WalletsService.confirmCashTopup (driverId: ${driverId}, ccrId: ${ccrId})`,
      );
    }
  }
  /**
   * Bloquea el wallet (status='blocked').
   * Efecto de negocio: impedir payouts/egresos; permitir topups y ajustes de regularización.
   */
  async blockDriverWallet(
    driverId: string,
    _dto: BlockDriverWalletDto,
  ): Promise<{
    driverId: string;
    previousStatus: 'active' | 'blocked';
    status: 'blocked';
    changed: boolean;
    changedAt: Date;
  }> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const result = await this.repo.setStatusWithLock(
          manager,
          driverId,
          'blocked',
        );
        return {
          driverId,
          previousStatus: result.previousStatus,
          status: 'blocked' as const,
          changed: result.changed,
          changedAt: result.changedAt,
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
   * Desbloquea el wallet (status='active').
   */
  async unblockDriverWallet(
    driverId: string,
    _dto: UnblockDriverWalletDto,
  ): Promise<{
    driverId: string;
    previousStatus: 'active' | 'blocked';
    status: 'active';
    changed: boolean;
    changedAt: Date;
  }> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const result = await this.repo.setStatusWithLock(
          manager,
          driverId,
          'active',
        );
        return {
          driverId,
          previousStatus: result.previousStatus,
          status: 'active' as const,
          changed: result.changed,
          changedAt: result.changedAt,
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
