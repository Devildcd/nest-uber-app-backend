import {
  DataSource,
  DeepPartial,
  EntityManager,
  SelectQueryBuilder,
} from 'typeorm';
import { Injectable } from '@nestjs/common';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { Zone } from '../entities/zone.entity';
import { ZonesQueryDto } from '../dtos/zones-query.dto';

export interface PaginationDto {
  page?: number;
  limit?: number;
}

@Injectable()
export class ZoneRepository extends BaseRepository<Zone> {
  constructor(dataSource: DataSource) {
    super(Zone, dataSource.createEntityManager(), 'ZoneRepository', 'Zone');
  }

  async createAndSave(
    partial: DeepPartial<Zone>,
    manager?: EntityManager,
  ): Promise<Zone> {
    const repo = this.scoped(manager);

    try {
      const anyPartial = partial as any;

      const cityId: string | undefined =
        anyPartial.cityId ?? anyPartial.city?.id;

      const geom = anyPartial.geom;

      // Si NO viene geom, usa save normal (pero en Zone debería venir siempre)
      if (geom === undefined) {
        const entity = repo.create(partial);
        return await repo.save(entity);
      }

      // Insert con expresión SQL para geom
      const qb = repo
        .createQueryBuilder()
        .insert()
        .into(Zone)
        .values({
          cityId,
          name: anyPartial.name,
          kind: anyPartial.kind ?? null,
          priority: anyPartial.priority ?? 100,
          active: anyPartial.active ?? true,
          geom: () => `ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)`,
        } as any)
        .setParameters({ geom: JSON.stringify(geom) })
        .returning(['id']);

      const result = await qb.execute();
      const id = result.identifiers?.[0]?.id ?? result.raw?.[0]?.id;

      const created = await repo.findOne({ where: { id } as any });
      return created!;
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  async findById(id: string, manager?: EntityManager): Promise<Zone | null> {
    const repo = this.scoped(manager);
    try {
      return await repo.findOne({ where: { id } as any });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }

  async findByIdWithRelations(
    id: string,
    relations: string[] = [],
    manager?: EntityManager,
  ): Promise<Zone | null> {
    return this.findWithRelations(id, relations, undefined, manager);
  }

  async findByCityAndName(
    cityId: string,
    name: string,
    opts: { onlyActive?: boolean } = { onlyActive: false },
  ): Promise<Zone | null> {
    const qb = this.qb('z')
      .where('z.cityId = :cid', { cid: cityId })
      .andWhere('LOWER(z.name) = LOWER(:name)', { name: name.trim() });

    if (opts.onlyActive) qb.andWhere('z.active = true');

    return this.getOneSafe(qb, 'findByCityAndName');
  }

  async findAllPaginated(
    pagination: PaginationDto,
    filters?: ZonesQueryDto,
  ): Promise<[Zone[], number]> {
    const { page = 1, limit = 10 } = pagination;

    const qb = this.qb('z')
      .leftJoinAndSelect('z.city', 'city')
      .orderBy('z.priority', 'DESC')
      .addOrderBy('z.name', 'ASC');

    if (filters) this.applyFilters(qb, filters);
    this.paginate(qb, page, limit);

    return this.getManyAndCountSafe(qb, 'findAllPaginated');
  }

  async updatePartial(
    id: string,
    patch: DeepPartial<Zone>,
    manager?: EntityManager,
  ): Promise<Zone> {
    const repo = this.scoped(manager);

    try {
      const anyPatch = patch as any;
      const { geom, ...rest } = anyPatch;

      if (geom === undefined) {
        await repo.update({ id } as any, rest);
        const updated = await repo.findOne({ where: { id } as any });
        return updated!;
      }

      const qb = repo
        .createQueryBuilder()
        .update()
        .set({
          ...rest,
          ...(geom === null
            ? { geom: null } // OJO: en Zone geom es NOT NULL (si permites null en patch, fallará DB)
            : { geom: () => `ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)` }),
        })
        .where('id = :id', { id });

      if (geom !== null) qb.setParameters({ geom: JSON.stringify(geom) });

      await qb.execute();

      const updated = await repo.findOne({ where: { id } as any });
      return updated!;
    } catch (err) {
      handleRepositoryError(this.logger, err, 'updatePartial', this.entityName);
    }
  }

  async lockByIdForUpdate(
    id: string,
    manager: EntityManager,
  ): Promise<Zone | null> {
    const repo = this.scoped(manager);

    try {
      return await repo
        .createQueryBuilder('z')
        .setLock('pessimistic_write')
        .where('z.id = :id', { id })
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

  /**
   * Resuelve “la mejor zona” para un punto dentro de una ciudad.
   * - Filtra por city + active
   * - ST_Covers para incluir bordes
   * - priority desc como desempate
   */
  async findBestByPoint(
    cityId: string,
    point: { lat: number; lng: number },
    opts: { onlyActive?: boolean } = { onlyActive: true },
  ): Promise<Zone | null> {
    const qb = this.qb('z')
      .where('z.cityId = :cid', { cid: cityId })
      .andWhere(
        `ST_Covers(z.geom, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))`,
        { lng: point.lng, lat: point.lat },
      )
      .orderBy('z.priority', 'DESC')
      .addOrderBy('z.createdAt', 'DESC')
      .limit(1);

    if (opts.onlyActive) qb.andWhere('z.active = true');

    return this.getOneSafe(qb, 'findBestByPoint');
  }

  // --------- helpers ----------
  private applyFilters(qb: SelectQueryBuilder<Zone>, f: ZonesQueryDto): void {
    if (f.cityId) qb.andWhere('z.cityId = :cid', { cid: f.cityId });

    if (f.q) qb.andWhere('z.name ILIKE :q', { q: `%${f.q}%` });
    if (f.name) qb.andWhere('z.name ILIKE :name', { name: `%${f.name}%` });

    if (f.kind) qb.andWhere('z.kind = :k', { k: f.kind });

    if (f.priorityGte != null)
      qb.andWhere('z.priority >= :p', { p: f.priorityGte });

    if (f.active !== undefined) qb.andWhere('z.active = :a', { a: f.active });
  }

  async countWithFilters(filters?: ZonesQueryDto): Promise<number> {
    const qb = this.qb('z').select('z.id');
    if (filters) this.applyFilters(qb, filters);

    try {
      return await qb.getCount();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'countWithFilters',
        this.entityName,
      );
      throw err;
    }
  }
}
