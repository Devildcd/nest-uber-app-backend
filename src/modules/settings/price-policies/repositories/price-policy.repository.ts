import {
  DataSource,
  DeepPartial,
  EntityManager,
  SelectQueryBuilder,
} from 'typeorm';
import { Injectable } from '@nestjs/common';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import {
  PricePolicy,
  PricePolicyScopeType,
} from '../entities/price-policy.entity';
import { PricePoliciesQueryDto } from '../dtos/price-policies-query.dto';

export interface PaginationDto {
  page?: number;
  limit?: number;
}

@Injectable()
export class PricePolicyRepository extends BaseRepository<PricePolicy> {
  constructor(dataSource: DataSource) {
    super(
      PricePolicy,
      dataSource.createEntityManager(),
      'PricePolicyRepository',
      'PricePolicy',
    );
  }

  async createAndSave(
    partial: DeepPartial<PricePolicy>,
    manager?: EntityManager,
  ): Promise<PricePolicy> {
    const repo = this.scoped(manager);
    const entity = repo.create(partial);

    try {
      return await repo.save(entity);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  async findById(
    id: string,
    opts: { relations?: boolean | Record<string, boolean> } = {
      relations: true,
    },
  ): Promise<PricePolicy | null> {
    try {
      if (opts.relations) {
        return await this.findOne({
          where: { id } as any,
          relations:
            typeof opts.relations === 'boolean'
              ? { city: true, zone: true }
              : (opts.relations as any),
        });
      }
      return await this.findOne({ where: { id } as any });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }

  async lockByIdForUpdate(
    id: string,
    manager: EntityManager,
  ): Promise<PricePolicy | null> {
    const repo = this.scoped(manager);
    try {
      return await repo
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id })
        .getOne();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'lockByIdForUpdate',
        this.entityName,
      );
      throw err;
    }
  }

  async findAllPaginated(
    pagination: PaginationDto,
    filters?: PricePoliciesQueryDto,
  ): Promise<[PricePolicy[], number]> {
    const { page = 1, limit = 10 } = pagination;

    const qb = this.qb('p')
      .leftJoinAndSelect('p.city', 'city')
      .leftJoinAndSelect('p.zone', 'zone')
      .orderBy('p.priority', 'DESC')
      .addOrderBy('p.createdAt', 'DESC');

    if (filters) this.applyFilters(qb, filters);
    this.paginate(qb, page, limit);

    return this.getManyAndCountSafe(qb, 'findAllPaginated');
  }

  async updatePartial(
    id: string,
    patch: DeepPartial<PricePolicy>,
    manager?: EntityManager,
  ): Promise<PricePolicy> {
    const repo = this.scoped(manager);
    try {
      await repo.update({ id } as any, patch as any);
      const updated = await repo.findOne({ where: { id } as any });
      return updated!;
    } catch (err) {
      handleRepositoryError(this.logger, err, 'updatePartial', this.entityName);
    }
  }

  /**
   * Candidatas por contexto (para engine pricing)
   * - Filtra por active y por ventana efectiva contra `at`
   * - NO evalúa `conditions` (eso lo hará el helper/service)
   * - Ordena por especificidad (ZONE > CITY > GLOBAL) y priority desc
   */
  async findCandidatesForContext(
    at: Date,
    ctx: { cityId?: string | null; zoneId?: string | null },
  ): Promise<PricePolicy[]> {
    const qb = this.qb('p')
      .where('p.active = true')
      .andWhere(
        `(p.effective_from IS NULL OR p.effective_from <= :at)
         AND (p.effective_to IS NULL OR p.effective_to >= :at)`,
        { at: at.toISOString() },
      )
      .andWhere(
        `
        (
          p.scope_type = :g
          OR (p.scope_type = :c AND p.city_id = :cityId)
          OR (p.scope_type = :z AND p.zone_id = :zoneId)
        )
        `,
        {
          g: PricePolicyScopeType.GLOBAL,
          c: PricePolicyScopeType.CITY,
          z: PricePolicyScopeType.ZONE,
          cityId: ctx.cityId ?? null,
          zoneId: ctx.zoneId ?? null,
        },
      )
      .orderBy(
        `CASE
          WHEN p.scope_type = 'ZONE' THEN 3
          WHEN p.scope_type = 'CITY' THEN 2
          ELSE 1
        END`,
        'DESC',
      )
      .addOrderBy('p.priority', 'DESC')
      .addOrderBy('p.effective_from', 'DESC');

    try {
      return await qb.getMany();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findCandidatesForContext',
        this.entityName,
      );
      throw err;
    }
  }

  // -------- helpers ----------
  private applyFilters(
    qb: SelectQueryBuilder<PricePolicy>,
    f: PricePoliciesQueryDto,
  ): void {
    if (f.scopeType) qb.andWhere('p.scope_type = :st', { st: f.scopeType });
    if (f.cityId) qb.andWhere('p.city_id = :cid', { cid: f.cityId });
    if (f.zoneId) qb.andWhere('p.zone_id = :zid', { zid: f.zoneId });
    if (f.active !== undefined) qb.andWhere('p.active = :a', { a: f.active });
    if (f.q) qb.andWhere('p.name ILIKE :q', { q: `%${f.q}%` });
  }
}
