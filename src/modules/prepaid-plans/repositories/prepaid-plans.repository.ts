// repositories/prepaid_plan.repository.ts
import {
  DataSource,
  DeepPartial,
  EntityManager,
  ILike,
  SelectQueryBuilder,
} from 'typeorm';
import { Injectable } from '@nestjs/common';
import { PrepaidPlan } from '../entities/prepaid-plans.entity';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { QueryPrepaidPlanDto } from '../dto/query-prepaid-plan.dto';

export interface PaginationDto {
  page?: number;
  limit?: number;
}

@Injectable()
export class PrepaidPlanRepository extends BaseRepository<PrepaidPlan> {
  constructor(dataSource: DataSource) {
    super(
      PrepaidPlan,
      dataSource.createEntityManager(),
      'PrepaidPlanRepository',
      'PrepaidPlan',
    );
  }

  /** Crear y guardar (participa en transacción si pasas manager) */
  async createAndSave(
    partial: DeepPartial<PrepaidPlan>,
    manager?: EntityManager,
  ): Promise<PrepaidPlan> {
    const repo = this.scoped(manager);
    const entity = repo.create(partial);
    try {
      return await repo.save(entity);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  /** Obtener por id */
  async findById(id: string): Promise<PrepaidPlan | null> {
    try {
      return await this.findOne({ where: { id } as any });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }

  /** Update parcial y retorno de entidad fresca */
  async updatePartial(
    id: string,
    patch: DeepPartial<PrepaidPlan>,
    manager?: EntityManager,
  ): Promise<PrepaidPlan> {
    const repo = this.scoped(manager);
    try {
      await repo.update({ id } as any, patch);
      const updated = await repo.findOne({ where: { id } as any });
      return updated!;
    } catch (err) {
      handleRepositoryError(this.logger, err, 'updatePartial', this.entityName);
    }
  }

  /** Activar/Desactivar */
  async toggleActive(
    id: string,
    isActive: boolean,
    manager?: EntityManager,
  ): Promise<PrepaidPlan> {
    const repo = this.scoped(manager);
    try {
      await repo.update({ id } as any, { isActive } as any);
      const updated = await repo.findOne({ where: { id } as any });
      return updated!;
    } catch (err) {
      handleRepositoryError(this.logger, err, 'toggleActive', this.entityName);
    }
  }

  /** Borrado por id */
  async removeById(id: string, manager?: EntityManager): Promise<void> {
    const repo = this.scoped(manager);
    try {
      await repo.delete({ id } as any);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'removeById', this.entityName);
    }
  }

  /** Listado paginado con filtros */
  async findAllPaginated(
    pagination: PaginationDto,
    filters?: QueryPrepaidPlanDto,
  ): Promise<[PrepaidPlan[], number]> {
    const { page = 1, limit = 10 } = pagination;

    const qb = this.qb('p').orderBy('p.created_at', 'DESC');

    if (filters) this.applyFilters(qb, filters);
    this.paginate(qb, page, limit);

    try {
      return await qb.getManyAndCount();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findAllPaginated',
        this.entityName,
      );
    }
  }

  // ---------- helpers privados ----------
  private applyFilters(
    qb: SelectQueryBuilder<PrepaidPlan>,
    f: QueryPrepaidPlanDto,
  ): void {
    if (typeof f.currency === 'string' && f.currency.length > 0) {
      qb.andWhere('p.currency = :cy', { cy: f.currency });
    }
    if (typeof f.isActive === 'string') {
      qb.andWhere('p.is_active = :ia', { ia: f.isActive === 'true' });
    }
    if (f.search) {
      qb.andWhere('p.name ILIKE :s', { s: `%${f.search}%` }); // o ILike si prefieres repo API
    }
  }
}

