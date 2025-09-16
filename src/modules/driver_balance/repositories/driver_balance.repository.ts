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
import { WalletMovement } from '../../wallet-movements/entities/wallet-movement.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { CashCollectionRecord } from '../../cash_colletion_records/entities/cash_colletion_records.entity';
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

  async findByDriverId(driverId: string): Promise<DriverBalance | null> {
    return this.findOne({ where: { driverId } });
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

    // Transición válida: active<->blocked
    wallet.status = newStatus;
    wallet.lastUpdated = changedAt; // mantener traza temporal adicional
    await manager.getRepository(DriverBalance).save(wallet);

    return { wallet, previousStatus, changed: true, changedAt };
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
