import { Injectable } from '@nestjs/common';
import { BaseRepository } from 'src/common/repositories/base.repository';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  SelectQueryBuilder,
} from 'typeorm';
import { City } from '../entities/city.entity';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { CitiesQueryDto } from '../dtos/cities-query.dto';

export interface PaginationDto {
  page?: number;
  limit?: number;
}

@Injectable()
export class CityRepository extends BaseRepository<City> {
  constructor(dataSource: DataSource) {
    super(City, dataSource.createEntityManager(), 'CityRepository', 'City');
  }

  /** Crear y guardar (participa en TX si pasas manager) */
  async createAndSave(
    partial: DeepPartial<City>,
    manager?: EntityManager,
  ): Promise<City> {
    const repo = this.scoped(manager);
    const entity = repo.create(partial);

    try {
      return await repo.save(entity);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  /** Obtener por id (sin relaciones por defecto) */
  async findById(id: string, manager?: EntityManager): Promise<City | null> {
    const repo = this.scoped(manager);
    try {
      return await repo.findOne({ where: { id } as any });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }

  /** Obtener por id con relaciones (usa tu helper findWithRelations) */
  async findByIdWithRelations(
    id: string,
    relations: string[] = [],
    manager?: EntityManager,
  ): Promise<City | null> {
    return this.findWithRelations(id, relations, undefined, manager);
  }

  /** Útil para validar duplicados (Unique name+countryCode) */
  async findByNameCountry(
    name: string,
    countryCode: string,
    opts: { onlyActive?: boolean } = { onlyActive: false },
  ): Promise<City | null> {
    const qb = this.qb('c')
      .where('LOWER(c.name) = LOWER(:name)', { name: name.trim() })
      .andWhere('c.countryCode = :cc', {
        cc: countryCode.trim().toUpperCase(),
      });

    if (opts.onlyActive) qb.andWhere('c.active = true');

    return this.getOneSafe(qb, 'findByNameCountry');
  }

  /** Listado paginado con ENTIDADES */
  async findAllPaginated(
    pagination: PaginationDto,
    filters?: CitiesQueryDto,
  ): Promise<[City[], number]> {
    const { page = 1, limit = 10 } = pagination;

    const qb = this.qb('c').orderBy('c.name', 'ASC');

    if (filters) this.applyFilters(qb, filters);
    this.paginate(qb, page, limit);

    return this.getManyAndCountSafe(qb, 'findAllPaginated');
  }

  /** Patch con retorno de entidad fresca */
  async updatePartial(
    id: string,
    patch: DeepPartial<City>,
    manager?: EntityManager,
  ): Promise<City> {
    const repo = this.scoped(manager);

    try {
      const anyPatch = patch as any;
      const { geom, ...rest } = anyPatch;

      // Si NO viene geom, usa update normal (simple y rápido)
      if (geom === undefined) {
        await repo.update({ id } as any, rest);
        const updated = await repo.findOne({ where: { id } as any });
        return updated!;
      }

      // Si viene geom (null o GeoJSON), usa QB para poder setear SRID=4326
      const qb = repo
        .createQueryBuilder()
        .update()
        .set({
          ...rest,
          ...(geom === null
            ? { geom: null }
            : {
                geom: () => `ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)`,
              }),
        })
        .where('id = :id', { id });

      if (geom !== null) {
        qb.setParameters({ geom: JSON.stringify(geom) });
      }

      await qb.execute();

      const updated = await repo.findOne({ where: { id } as any });
      return updated!;
    } catch (err) {
      handleRepositoryError(this.logger, err, 'updatePartial', this.entityName);
    }
  }

  /** Lock FOR UPDATE (para operaciones dentro de TX) */
  async lockByIdForUpdate(
    id: string,
    manager: EntityManager,
  ): Promise<City | null> {
    const repo = this.scoped(manager);

    try {
      return await repo
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id })
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
   * Resolver ciudad por punto usando geom (si está cargado).
   * Uso ST_Covers para incluir puntos en el borde.
   */
  async findByPoint(
    point: { lat: number; lng: number },
    opts: { onlyActive?: boolean } = { onlyActive: true },
  ): Promise<City | null> {
    const qb = this.qb('c')
      .where('c.geom IS NOT NULL')
      .andWhere(
        `ST_Covers(c.geom, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))`,
        { lng: point.lng, lat: point.lat },
      );

    if (opts.onlyActive) qb.andWhere('c.active = true');

    return this.getOneSafe(qb, 'findByPoint');
  }

  // --------- helpers privados ----------
  private applyFilters(qb: SelectQueryBuilder<City>, f: CitiesQueryDto): void {
    if (f.q) qb.andWhere('c.name ILIKE :q', { q: `%${f.q}%` });
    if (f.name) qb.andWhere('c.name ILIKE :name', { name: `%${f.name}%` });
    if (f.countryCode)
      qb.andWhere('c.country_code = :cc', { cc: f.countryCode });
    if (f.timezone) qb.andWhere('c.timezone = :tz', { tz: f.timezone });
    if (f.active !== undefined) qb.andWhere('c.active = :a', { a: f.active });
  }

  /** (Opcional) si quieres contar por filtros por separado en algún endpoint */
  async countWithFilters(filters?: CitiesQueryDto): Promise<number> {
    const qb = this.qb('c').select('c.id');
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
