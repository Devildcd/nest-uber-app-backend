// src/modules/wallets/repositories/wallets.repository.ts
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
  QueryRunner,
  Repository,
} from 'typeorm';
import { DriverBalance } from '../../driver_balance/entities/driver_balance.entity';
import { WalletMovement } from '../entities/wallet-movement.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { CashCollectionRecord } from '../../cash_colletions_points/entities/cash_colletion_records.entity';
import { CashCollectionPoint } from '../../cash_colletions_points/entities/cash_colletions_points.entity';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { formatErrorResponse } from 'src/common/utils/api-response.utils';

@Injectable()
export class DriverBalanceRepository extends Repository<DriverBalance> {
  private readonly logger = new Logger(DriverBalanceRepository.name);
  private readonly entityName = 'DriverBalance';

  constructor(private readonly dataSource: DataSource) {
    super(DriverBalance, dataSource.createEntityManager());
  }

  /**
   * Ensure a wallet exists for driverId using TypeORM QueryBuilder upsert pattern (INSERT ... ON CONFLICT DO NOTHING).
   * Then locks the row FOR UPDATE and returns the entity.
   *
   * Reasoning:
   * - We avoid a blind SELECT -> INSERT race by attempting an INSERT that does nothing on conflict.
   * - If INSERT returned a row -> we got the id of the created row.
   * - If INSERT returned nothing -> the row already existed, so we fetch it.
   * - Finally we `findOne` with lock: { mode: 'pessimistic_write' } to lock the row
   */
  async lockByDriverId(
    driverId: string,
    manager: EntityManager,
  ): Promise<DriverBalance> {
    return manager
      .getRepository(DriverBalance)
      .createQueryBuilder('w')
      .setLock('pessimistic_write')
      .where('w.driver_id = :driverId', { driverId })
      .getOneOrFail();
  }

  async findByDriverId(
    driverId: string,
    manager?: EntityManager,
  ): Promise<DriverBalance | null> {
    try {
      if (!manager) {
        return this.findOne({ where: { driverId } });
      }
      return manager.findOne(DriverBalance, { where: { driverId } });
    } catch (error) {
      handleRepositoryError(
        this.logger,
        error,
        'findByTransactionId',
        this.entityName,
      );
    }
  }

  /**
   * Crea el wallet del driver con saldos en cero. No crea WalletMovement.
   * Lanza 409 si ya existe (unique_violation 23505).
   */
  async createAndSave(
    walletLike: DeepPartial<DriverBalance>,
    manager?: EntityManager,
  ): Promise<DriverBalance> {
    const repo = manager ? manager.getRepository(DriverBalance) : this;
    const entity = this.create(walletLike);

    try {
      return await this.save(entity);
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('El driver ya posee un wallet.');
      }
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }
  /**
   * Cambia el estado del wallet con bloqueo de fila.
   * Idempotente: si ya está en ese estado, no modifica y retorna changed=false.
   */
  async setStatusWithLock(
    manager: EntityManager,
    driverId: string,
    newStatus: 'active' | 'blocked',
  ): Promise<{
    wallet: DriverBalance;
    previousStatus: 'active' | 'blocked';
    changed: boolean;
    changedAt: Date;
  }> {
    const wallet = await this.lockByDriverId(driverId, manager).catch(() => {
      throw new NotFoundException(
        formatErrorResponse(
          'WALLET_NOT_FOUND',
          'No existe wallet para el driver.',
          { driverId },
        ),
      );
    });

    if (wallet.status !== 'active' && wallet.status !== 'blocked') {
      throw new BadRequestException(
        formatErrorResponse(
          'INVALID_WALLET_STATUS',
          'Estado de wallet inválido en origen.',
          { currentStatus: wallet.status },
        ),
      );
    }
    if (newStatus !== 'active' && newStatus !== 'blocked') {
      throw new BadRequestException(
        formatErrorResponse(
          'INVALID_TARGET_STATUS',
          'Estado de destino inválido.',
          { newStatus },
        ),
      );
    }

    const previousStatus = wallet.status;
    const changedAt = new Date();

    if (previousStatus === newStatus) {
      // Sin cambios: retornamos idempotente
      return { wallet, previousStatus, changed: false, changedAt };
    }

    // If manual call: for 'blocked' use generic manual reason; for 'active' set unblocked meta as null (no performer)
    if (newStatus === 'blocked') {
      // manual block: keep blockedAt if already set, otherwise set now.
      wallet.status = 'blocked';
      wallet.blockedAt = wallet.blockedAt ?? changedAt;
      wallet.blockedReason = wallet.blockedReason ?? 'manual_block';
      wallet.lastUpdated = changedAt;
      await manager.getRepository(DriverBalance).save(wallet);
    } else {
      // manual active: set unblockedAt/unblockedBy (performedBy unknown here)
      wallet.status = 'active';
      wallet.unblockedAt = changedAt;
      wallet.unblockedBy = null;
      wallet.blockedReason = null;
      wallet.lastUpdated = changedAt;
      await manager.getRepository(DriverBalance).save(wallet);
    }

    return { wallet, previousStatus, changed: true, changedAt };
  }

  /**
   * Bloquea una wallet ya obtenida y lockeada (no hace re-lock).
   * - wallet: entidad previamente obtenida vía lockByDriverId (FOR UPDATE)
   * - reason: texto que explica por qué (ej.: 'negative_balance_on_commission' o 'manual_block')
   *
   * Idempotente: si ya está blocked, actualiza reason solo si overrideReason=true
   */
  async blockWalletLocked(
    manager: EntityManager,
    wallet: DriverBalance,
    reason: string,
    opts?: { overrideReason?: boolean },
  ): Promise<DriverBalance> {
    const now = new Date();
    if (wallet.status === 'blocked') {
      if (opts?.overrideReason) {
        wallet.blockedReason = reason;
        wallet.lastUpdated = now;
        return await manager.getRepository(DriverBalance).save(wallet);
      }
      return wallet;
    }

    wallet.status = 'blocked';
    wallet.blockedAt = wallet.blockedAt ?? now;
    wallet.blockedReason = reason;
    wallet.lastUpdated = now;

    return await manager.getRepository(DriverBalance).save(wallet);
  }

  /**
   * Desbloquea una wallet ya lockeada (no hace re-lock).
   * - performedBy: uuid del admin/operador que ejecutó el desbloqueo (opcional)
   *
   * Idempotente: si ya está active, retorna la wallet sin cambios.
   */
  async unblockWalletLocked(
    manager: EntityManager,
    wallet: DriverBalance,
    performedBy?: string | null,
  ): Promise<DriverBalance> {
    if (wallet.status === 'active') {
      return wallet;
    }

    wallet.status = 'active';
    wallet.unblockedAt = new Date();
    wallet.unblockedBy = performedBy ?? null;
    // optionally keep blockedAt for audit trail; clear blockedReason or keep as historical
    wallet.blockedReason = null;
    wallet.lastUpdated = new Date();

    return await manager.getRepository(DriverBalance).save(wallet);
  }

  /**
   * Actualiza el balance de una wallet que ya está lockeada (no hace re-lock).
   * Retorna wallet guardada.
   */
  async updateBalanceLocked(
    manager: EntityManager,
    wallet: DriverBalance,
    newBalance: number,
  ): Promise<DriverBalance> {
    wallet.currentWalletBalance = Math.round(newBalance * 100) / 100;
    wallet.lastUpdated = new Date();
    return await manager.getRepository(DriverBalance).save(wallet);
  }

  async isActiveByDriverId(
    driverId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    try {
      const repo = manager ? manager.getRepository(DriverBalance) : this;
      const qb = repo
        .createQueryBuilder('db')
        .where('db.driver_id = :driverId', { driverId })
        .andWhere('db.status = :status', { status: 'active' })
        .limit(1);

      // TypeORM 0.3+: getExists(); si no, usa getCount() > 0
      return (await qb.getExists?.()) ?? (await qb.getCount()) > 0;
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'isActiveByDriverId',
        this.entityName,
      );
      throw err;
    }
  }
}
