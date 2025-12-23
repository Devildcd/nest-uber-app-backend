// prepaid-plans/repositories/user-prepaid-plan.repository.ts
import { DataSource, DeepPartial, EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import {
  UserPrepaidPlan,
  UserPrepaidPlanStatus,
} from '../entities/user-prepaid-plans.entity';

@Injectable()
export class UserPrepaidPlanRepository extends BaseRepository<UserPrepaidPlan> {
  constructor(dataSource: DataSource) {
    super(
      UserPrepaidPlan,
      dataSource.createEntityManager(),
      'UserPrepaidPlanRepository',
      'UserPrepaidPlan',
    );
  }

  async createAndSave(
    partial: DeepPartial<UserPrepaidPlan>,
    manager?: EntityManager,
  ): Promise<UserPrepaidPlan> {
    const repo = this.scoped(manager);
    try {
      return await repo.save(repo.create(partial));
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  async findByInitialTransactionId(
    txId: string,
    manager?: EntityManager,
  ): Promise<UserPrepaidPlan | null> {
    const repo = this.scoped(manager);
    try {
      return await repo.findOne({
        where: { initialPurchaseTransactionId: txId } as any,
      });
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findByInitialTransactionId',
        this.entityName,
      );
    }
  }

  /**
   * Devuelve el plan ACTIVO del usuario (si existe):
   * - status = 'active'
   * - no expirado (expiration_date IS NULL OR > NOW())
   * - si el plan del catálogo define trips_included, up.trips_remaining > 0
   * Orden: expiración más lejana primero, luego compra más reciente.
   */
  async findActiveForUser(
    userId: string,
    manager?: EntityManager,
  ): Promise<UserPrepaidPlan | null> {
    try {
      const qb = (manager ? manager.getRepository(UserPrepaidPlan) : this)
        .createQueryBuilder('up')
        .leftJoinAndSelect('up.plan', 'p')
        .where('up.user_id = :userId', { userId })
        .andWhere('up.status = :st', { st: UserPrepaidPlanStatus.ACTIVE })
        .andWhere('(up.expiration_date IS NULL OR up.expiration_date > NOW())')
        .andWhere(
          '(p.trips_included IS NULL OR COALESCE(up.trips_remaining, 0) > 0)',
        )
        .orderBy('up.expiration_date', 'DESC', 'NULLS LAST')
        .addOrderBy('up.purchase_date', 'DESC')
        .limit(1);

      return await this.getOneSafe(qb, 'findActiveForUser');
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findActiveForUser',
        this.entityName,
      );
      throw err;
    }
  }

  /**
   * Lista TODOS los planes activos del usuario:
   * - status = 'active'
   * - no expirados (expiration_date IS NULL OR > NOW())
   * - si el plan define trips_included, requiere trips_remaining > 0
   * Orden:
   *   1) expiración más lejana primero (NULLS LAST)
   *   2) compra más reciente
   */
  async findAllActiveForUser(
    userId: string,
    manager?: EntityManager,
  ): Promise<UserPrepaidPlan[]> {
    try {
      const qb = (manager ? manager.getRepository(UserPrepaidPlan) : this)
        .createQueryBuilder('up')
        .leftJoinAndSelect('up.plan', 'p')
        .where('up.user_id = :userId', { userId })
        .andWhere('up.status = :st', { st: UserPrepaidPlanStatus.ACTIVE })
        .andWhere('(up.expiration_date IS NULL OR up.expiration_date > NOW())')
        .andWhere(
          '(p.trips_included IS NULL OR COALESCE(up.trips_remaining, 0) > 0)',
        )
        .orderBy('up.expiration_date', 'DESC', 'NULLS LAST')
        .addOrderBy('up.purchase_date', 'DESC');

      return await qb.getMany();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findAllActiveForUser',
        this.entityName,
      );
      throw err;
    }
  }

  /**
   * Marca como EXPIRED todos los planes:
   *  - status = ACTIVE
   *  - expiration_date <= :now  (y no null)
   * Devuelve la cantidad de filas afectadas.
   */
  async bulkExpireDue(now: Date, manager?: EntityManager): Promise<number> {
    const repo = this.scoped(manager);
    try {
      const res = await repo
        .createQueryBuilder()
        .update(UserPrepaidPlan)
        .set({
          status: UserPrepaidPlanStatus.EXPIRED,
          // actualiza updated_at con la hora de ejecución del cron
          updatedAt: now as any,
        })
        .where('status = :st', { st: UserPrepaidPlanStatus.ACTIVE })
        .andWhere('expiration_date IS NOT NULL')
        .andWhere('expiration_date <= :now', { now })
        .execute();

      return res.affected ?? 0;
    } catch (err) {
      handleRepositoryError(this.logger, err, 'bulkExpireDue', this.entityName);
      throw err;
    }
  }
}
