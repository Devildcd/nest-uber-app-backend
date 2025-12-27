import {
  DataSource,
  DeepPartial,
  EntityManager,
  SelectQueryBuilder,
} from 'typeorm';
import { Injectable } from '@nestjs/common';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { TripStop } from '../entities/trip-stop.entity';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

@Injectable()
export class TripStopsRepository extends BaseRepository<TripStop> {
  constructor(dataSource: DataSource) {
    super(
      TripStop,
      dataSource.createEntityManager(),
      'TripStopsRepository',
      'TripStop',
    );
  }

  /** Crea UNA parada (participa en transacción si pasas manager) */
  async createAndSave(
    partial: DeepPartial<TripStop>,
    manager?: EntityManager,
  ): Promise<TripStop> {
    const repo = this.scoped(manager);
    const entity = repo.create(partial);
    try {
      return await repo.save(entity);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  /** Crea VARIAS paradas para un trip (batch). Devuelve las insertadas (con ids). */
  async createManyForTrip(
    tripId: string,
    stops: DeepPartial<TripStop>[],
    manager?: EntityManager,
  ): Promise<TripStop[]> {
    if (!stops?.length) return [];
    const repo = this.scoped(manager);

    // Normaliza seq si el cliente mandó valores; si no, asignamos 1..N
    const prepared = stops.map((s, i) => ({
      ...s,
      tripId,
      seq: s.seq && s.seq > 0 ? s.seq : i + 1,
    }));

    try {
      const entities = repo.create(prepared);
      const saved = await repo.save(entities);
      // Asegura 1..N sin huecos por si vinieron seqs raros
      await this.normalizeSequences(tripId, manager ?? this.manager);
      return saved;
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'createManyForTrip',
        this.entityName,
      );
    }
  }

  /** Update parcial y retorno de entidad refrescada */
  async updatePartial(
    id: string,
    patch: DeepPartial<TripStop>,
    manager?: EntityManager,
  ): Promise<TripStop> {
    const repo = this.scoped(manager);
    try {
      await repo.update({ id }, patch as QueryDeepPartialEntity<TripStop>);
      const updated = await repo.findOne({ where: { id } });
      return updated!;
    } catch (err) {
      handleRepositoryError(this.logger, err, 'updatePartial', this.entityName);
    }
  }

  /** Delete por id */
  async deleteById(id: string, manager?: EntityManager): Promise<void> {
    const repo = this.scoped(manager);
    try {
      await repo.delete({ id } as any);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'deleteById', this.entityName);
    }
  }

  /** Borra todas las paradas de un trip (útil para reemplazos) */
  async deleteAllForTrip(
    tripId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    try {
      await repo
        .createQueryBuilder()
        .delete()
        .from(TripStop)
        .where('trip_id = :tripId', { tripId })
        .execute();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'deleteAllForTrip',
        this.entityName,
      );
    }
  }

  /** Get por id */
  async findById(
    id: string,
    manager?: EntityManager,
  ): Promise<TripStop | null> {
    try {
      const qb = (
        manager ? manager.getRepository(TripStop) : this
      ).createQueryBuilder('s');
      return await qb.where('s.id = :id', { id }).getOne();
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }

  /** Get por id con lock FOR UPDATE (para marcar llegada, etc.) */
  async findByIdForUpdate(
    id: string,
    manager?: EntityManager,
  ): Promise<TripStop | null> {
    try {
      const qb = (
        manager ? manager.getRepository(TripStop) : this
      ).createQueryBuilder('s');
      return await qb
        .setLock('pessimistic_write')
        .where('s.id = :id', { id })
        .getOne();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findByIdForUpdate',
        this.entityName,
      );
    }
  }

  /** Todas las paradas del trip ordenadas por seq ASC */
  async findByTripOrdered(
    tripId: string,
    manager?: EntityManager,
  ): Promise<TripStop[]> {
    try {
      const qb = (
        manager ? manager.getRepository(TripStop) : this
      ).createQueryBuilder('s');
      return await qb
        .where('s.trip_id = :tripId', { tripId })
        .orderBy('s.seq', 'ASC')
        .getMany();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findByTripOrdered',
        this.entityName,
      );
    }
  }

  /** Siguiente parada pendiente (reached_at IS NULL) */
  async findNextPendingStop(
    tripId: string,
    manager?: EntityManager,
  ): Promise<TripStop | null> {
    try {
      const qb = (
        manager ? manager.getRepository(TripStop) : this
      ).createQueryBuilder('s');
      return await qb
        .where('s.trip_id = :tripId', { tripId })
        .andWhere('s.reached_at IS NULL')
        .orderBy('s.seq', 'ASC')
        .limit(1)
        .getOne();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findNextPendingStop',
        this.entityName,
      );
    }
  }

  /** Conteo por trip */
  async countByTrip(tripId: string, manager?: EntityManager): Promise<number> {
    try {
      const qb = (
        manager ? manager.getRepository(TripStop) : this
      ).createQueryBuilder('s');
      return await qb.where('s.trip_id = :tripId', { tripId }).getCount();
    } catch (err) {
      handleRepositoryError(this.logger, err, 'countByTrip', this.entityName);
    }
  }

  /** Reemplazo total de paradas del trip (borra + inserta + normaliza 1..N) */
  async replaceAllForTrip(
    tripId: string,
    stops: DeepPartial<TripStop>[],
    manager?: EntityManager,
  ): Promise<TripStop[]> {
    const mgr = manager ?? this.manager;
    try {
      await this.deleteAllForTrip(tripId, mgr);
      const inserted = await this.createManyForTrip(tripId, stops, mgr);
      await this.normalizeSequences(tripId, mgr);
      return inserted;
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'replaceAllForTrip',
        this.entityName,
      );
    }
  }

  /** Reordenar (recibe pares stopId/seq), luego normaliza 1..N */
  async reorderForTrip(
    tripId: string,
    newOrder: { stopId: string; seq: number }[],
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    try {
      // Aplica seqs provisionales
      for (const { stopId, seq } of newOrder) {
        await repo.update({ id: stopId } as any, { seq } as any);
      }
      // Normaliza 1..N sin huecos
      await this.normalizeSequences(tripId, manager ?? this.manager);
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'reorderForTrip',
        this.entityName,
      );
    }
  }

  /** Marca reached_at para una parada */
  async markStopReached(
    stopId: string,
    reachedAt: Date,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    try {
      await repo.update({ id: stopId } as any, { reachedAt } as any);
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'markStopReached',
        this.entityName,
      );
    }
  }

  /** Paradas dentro de un radio (requiere PostGIS) */
  async findStopsWithinRadius(
    tripId: string,
    center: { lat: number; lng: number },
    radiusMeters: number,
    manager?: EntityManager,
  ): Promise<TripStop[]> {
    const { lat, lng } = center;
    try {
      const qb = (
        manager ? manager.getRepository(TripStop) : this
      ).createQueryBuilder('s');
      return await qb
        .where('s.trip_id = :tripId', { tripId })
        .andWhere(
          `
          ST_DWithin(
            s.point,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
            :radius
          )
        `,
          { lat, lng, radius: radiusMeters },
        )
        .orderBy(
          `
          ST_Distance(
            s.point,
            ST_SetSRID(ST_MakePoint(:lng2, :lat2), 4326)::geography
          )
        `,
          'ASC',
        )
        .setParameters({ lng2: lng, lat2: lat })
        .getMany();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findStopsWithinRadius',
        this.entityName,
      );
    }
  }

  // ----------------- Helpers privados -----------------

  /** Re-numera a 1..N por seq ASC (sin huecos/duplicados) */
  private async normalizeSequences(
    tripId: string,
    manager: EntityManager,
  ): Promise<void> {
    try {
      const qb = manager.getRepository(TripStop).createQueryBuilder('s');
      const rows = await qb
        .select(['s.id AS id', 's.seq AS seq'])
        .where('s.trip_id = :tripId', { tripId })
        .orderBy('s.seq', 'ASC')
        .addOrderBy('s.created_at', 'ASC') // fallback estable si hay empates
        .getRawMany<{ id: string; seq: number }>();

      let next = 1;
      for (const r of rows) {
        await manager
          .getRepository(TripStop)
          .update({ id: r.id } as any, { seq: next } as any);
        next += 1;
      }
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'normalizeSequences',
        this.entityName,
      );
    }
  }
}
