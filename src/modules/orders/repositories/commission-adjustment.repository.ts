// src/modules/orders/repositories/commission-adjustment.repository.ts
import { Injectable } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  SelectQueryBuilder,
} from 'typeorm';

import { BaseRepository } from 'src/common/repositories/base.repository';
import { CommissionAdjustment } from '../entities/comission-adjustment.entity';
import { Order } from '../entities/order.entity';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';

export const COMMISSION_ADJUSTMENT_RELATIONS = ['order'] as const;
export type CommissionAdjustmentRelation =
  (typeof COMMISSION_ADJUSTMENT_RELATIONS)[number];

@Injectable()
export class CommissionAdjustmentRepository extends BaseRepository<CommissionAdjustment> {
  constructor(dataSource: DataSource) {
    super(
      CommissionAdjustment,
      dataSource.createEntityManager(),
      'CommissionAdjustmentRepository',
      'CommissionAdjustment',
    );
  }

  /**
   * Crea y persiste una entidad parcial (helper genérico).
   * Útil para crear adjuntos fuera del flow de negocio principal.
   */
  async createAndSave(
    partial: DeepPartial<CommissionAdjustment>,
    manager?: EntityManager,
  ): Promise<CommissionAdjustment> {
    const repo = this.scoped(manager);
    const entity = repo.create(partial);
    try {
      return await repo.save(entity);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
      throw err;
    }
  }

  /**
   * Busca un ajuste por orderId + adjustmentSeq.
   * Acepta `relations` y `manager` para uso dentro de transacciones.
   */
  async findByOrderAndSeq(
    orderId: string,
    seq: string,
    relations: CommissionAdjustmentRelation[] = [],
    manager?: EntityManager,
  ): Promise<CommissionAdjustment | null> {
    try {
      const repo = manager ? manager.getRepository(CommissionAdjustment) : this;
      const qb = repo.createQueryBuilder('ca');

      // joins seguros si piden relaciones
      if (relations?.length) {
        if (relations.includes('order')) {
          qb.leftJoinAndSelect('ca.order', 'order');
        }
      }

      qb.where('ca.order_id = :orderId', { orderId })
        .andWhere('ca.adjustment_seq = :seq', { seq })
        .limit(1);

      return await this.getOneSafe(qb, 'findByOrderAndSeq');
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findByOrderAndSeq',
        this.entityName,
      );
      throw err;
    }
  }

  /**
   * Crea un CommissionAdjustment para un pedido.
   * Nota: no maneja la colisión UNIQUE (23505) — el caller (servicio) puede capturarla
   * si desea implementar recuperación idempotente en situaciones de race.
   */
  async createForOrder(
    args: {
      order: Order;
      adjustmentSeq: string;
      deltaFee: number;
      originalFee: number;
      newFee: number;
      reason?: string;
    },
    manager?: EntityManager,
  ): Promise<CommissionAdjustment> {
    const repo = this.scoped(manager);
    const entityPartial: DeepPartial<CommissionAdjustment> = {
      order: args.order,
      adjustmentSeq: args.adjustmentSeq,
      deltaFee: args.deltaFee,
      originalFee: args.originalFee,
      newFee: args.newFee,
      reason: args.reason,
    };

    const entity = repo.create(entityPartial);
    try {
      return await repo.save(entity);
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'createForOrder',
        this.entityName,
      );
      throw err;
    }
  }

  // ---------- helpers privados si los necesitas en el futuro ----------

  private attachRelations(
    qb: SelectQueryBuilder<CommissionAdjustment>,
    relations: CommissionAdjustmentRelation[],
  ) {
    if (!relations?.length) return;
    if (relations.includes('order')) qb.leftJoinAndSelect('ca.order', 'order');
  }
}
