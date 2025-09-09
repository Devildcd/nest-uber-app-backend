// trip.repository.ts
import {
  DataSource,
  DeepPartial,
  EntityManager,
  SelectQueryBuilder,
} from 'typeorm';
import { Injectable } from '@nestjs/common';
import { Trip, TripStatus } from '../entities/trip.entity';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { TripsQueryDto } from '../dto/trips-query.dto';
import { NearbyParams, TripListItemProjection } from '../interfaces/trip.interfaces';

export interface PaginationDto {
  page?: number;
  limit?: number;
}

@Injectable()
export class TripRepository extends BaseRepository<Trip> {
  constructor(dataSource: DataSource) {
    super(Trip, dataSource.createEntityManager(), 'TripRepository', 'Trip');
  }

  /** Crear y guardar (participa en transacción si pasas manager) */
  async createAndSave(
    partial: DeepPartial<Trip>,
    manager?: EntityManager,
  ): Promise<Trip> {
    const repo = this.scoped(manager);
    const entity = repo.create(partial);
    try {
      return await repo.save(entity);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  /** Obtener por id (opcionalmente con relaciones) */
  async findById(
    id: string,
    opts: { relations?: boolean } = { relations: true },
  ): Promise<Trip | null> {
    const qb = this.qb('t').where('t.id = :id', { id });

    if (opts.relations) {
      qb.leftJoinAndSelect('t.passenger', 'passenger')
        .leftJoinAndSelect('t.driver', 'driver')
        .leftJoinAndSelect('t.vehicle', 'vehicle')
        .leftJoinAndSelect('t.order', 'order');
    }

    return this.getOneSafe(qb, 'findById');
  }

  /** Listado paginado con ENTIDADES (carga relaciones) */
  async findAllPaginated(
    pagination: PaginationDto,
    filters?: TripsQueryDto,
  ): Promise<[Trip[], number]> {
    const { page = 1, limit = 10 } = pagination;

    // Nota: aunque cargamos entidades, usamos nombres de columna para where/order
    const qb = this.qb('t')
      .leftJoinAndSelect('t.passenger', 'passenger')
      .leftJoinAndSelect('t.driver', 'driver')
      .leftJoinAndSelect('t.vehicle', 'vehicle')
      .leftJoinAndSelect('t.order', 'order')
      .orderBy('t.requested_at', 'DESC');

    if (filters) this.applyFilters(qb, filters);
    this.paginate(qb, page, limit);

    return this.getManyAndCountSafe(qb, 'findAllPaginated');
  }

  /**
   * Listado paginado en PROYECCIÓN (sin relaciones) — recomendado para “listas”
   * Devuelve objetos planos con lo necesario; muy performante.
   */
  async findListPaginatedProjection(
    pagination: PaginationDto,
    filters?: TripsQueryDto,
  ): Promise<[TripListItemProjection[], number]> {
    const { page = 1, limit = 10 } = pagination;

    const qb = this.qb('t')
      .select([
        't.id AS id',
        't.passenger_id AS "passengerId"',
        't.driver_id AS "driverId"',
        't.vehicle_id AS "vehicleId"',
        't.current_status AS "currentStatus"',
        't.payment_mode AS "paymentMode"',
        't.requested_at AS "requestedAt"',
        't.pickup_address AS "pickupAddress"',
        't.fare_final_currency AS "fareFinalCurrency"',
        't.fare_total AS "fareTotal"',
      ])
      .orderBy('t.requested_at', 'DESC');

    if (filters) this.applyFilters(qb, filters);
    this.paginate(qb, page, limit);

    try {
      const [rows, total] = await Promise.all([
        qb.getRawMany<TripListItemProjection>(),
        this.countWithFilters(filters),
      ]);
      return [rows, total];
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findListPaginatedProjection',
        this.entityName,
      );
    }
  }

  /** Update parcial, devuelve entidad actualizada (participa en transacción si pasas manager) */
  async updatePartial(
    id: string,
    patch: DeepPartial<Trip>,
    manager?: EntityManager,
  ): Promise<Trip> {
    const repo = this.scoped(manager);
    try {
      await repo.update({ id } as any, patch);
      const updated = await repo.findOne({
        where: { id } as any,
        relations: { passenger: true, driver: true, vehicle: true },
      });
      return updated!;
    } catch (err) {
      handleRepositoryError(this.logger, err, 'updatePartial', this.entityName);
    }
  }

  /** Viaje activo por pasajero (pending/assigning/accepted/arriving/in_progress) */
  async findActiveByPassenger(passengerId: string): Promise<Trip | null> {
    const active: TripStatus[] = [
      TripStatus.PENDING,
      TripStatus.ASSIGNING,
      TripStatus.ACCEPTED,
      TripStatus.ARRIVING,
      TripStatus.IN_PROGRESS,
    ];
    const qb = this.qb('t')
      .leftJoinAndSelect('t.driver', 'driver')
      .leftJoinAndSelect('t.vehicle', 'vehicle')
      .where('t.passenger_id = :pid', { pid: passengerId })
      .andWhere('t.current_status IN (:...st)', { st: active })
      .orderBy('t.requested_at', 'DESC')
      .limit(1);

    return this.getOneSafe(qb, 'findActiveByPassenger');
  }

  /** (Opcional) lectura con lock para flujos sensibles a concurrencia */
  async findByIdForUpdate(
    id: string,
    manager?: EntityManager,
  ): Promise<Trip | null> {
    try {
      const qb = (manager ? manager.getRepository(Trip) : this).createQueryBuilder('t');
      return await qb
        .setLock('pessimistic_write')
        .where('t.id = :id', { id })
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

  // ----------------- Helpers privados -----------------

  /** Aplica filtros del FindTripsQueryDto usando SIEMPRE nombres de columna reales */
  private applyFilters(qb: SelectQueryBuilder<Trip>, f: TripsQueryDto): void {
    if (f.passengerId)  qb.andWhere('t.passenger_id = :pid', { pid: f.passengerId });
    if (f.driverId)     qb.andWhere('t.driver_id = :did', { did: f.driverId });
    if (f.vehicleId)    qb.andWhere('t.vehicle_id = :vid', { vid: f.vehicleId });
    if (f.status)       qb.andWhere('t.current_status = :st', { st: f.status });
    if (f.paymentMode)  qb.andWhere('t.payment_mode = :pm', { pm: f.paymentMode });

    if (f.requestedFrom) qb.andWhere('t.requested_at >= :rf', { rf: f.requestedFrom });
    if (f.requestedTo)   qb.andWhere('t.requested_at <= :rt', { rt: f.requestedTo });

    if (f.completedFrom) qb.andWhere('t.completed_at >= :cf', { cf: f.completedFrom });
    if (f.completedTo)   qb.andWhere('t.completed_at <= :ct', { ct: f.completedTo });
  }

  /** Conteo total con los mismos filtros (para proyección) */
  private async countWithFilters(filters?: TripsQueryDto): Promise<number> {
    const qb = this.qb('t').select('t.id');
    if (filters) this.applyFilters(qb, filters);
    try {
      return await qb.getCount();
    } catch (err) {
      handleRepositoryError(this.logger, err, 'countWithFilters', this.entityName);
    }
  }

  /**
 * Busca viajes cuyo pickup esté dentro de un radio (metros) desde (lat,lng),
 * devolviendo ENTIDADES + relaciones (passenger, driver, vehicle),
 * ordenados por cercanía y paginados.
 *
 * Requiere índice espacial:
 *   CREATE INDEX IF NOT EXISTS idx_trips_pickup_point_gist
 *   ON trips USING GIST (pickup_point);
 */
async findNearbyPickupsEntities(
  params: NearbyParams,
  manager?: EntityManager,
): Promise<[Trip[], number]> {
  const {
    lat,
    lng,
    radiusMeters,
    statusIn,
    page = 1,
    limit = 10,
  } = params;

  // saneo del radio (evita scans absurdos)
  const meters = Math.max(1, Math.min(100_000, Math.floor(radiusMeters || 0))); // 1 m .. 100 km

  const repo = this.scoped(manager);
  const qb = repo
    .createQueryBuilder('t')
    .leftJoinAndSelect('t.passenger', 'passenger')
    .leftJoinAndSelect('t.driver', 'driver')
    .leftJoinAndSelect('t.vehicle', 'vehicle')
    // .leftJoinAndSelect('t.order', 'order') // ← descomenta si EXISTE esa relación en tu entidad
    // filtro geoespacial por radio (GEOGRAPHY usa METROS)
    .where(
      `ST_DWithin(
         t.pickup_point,
         ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
         :meters
       )`,
    )
    // distancia (metros) para ordenar por cercanía
    .addSelect(
      `ST_Distance(
         t.pickup_point,
         ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
       )`,
      'distanceMeters',
    )
    .setParameters({ lat, lng, meters })
    .orderBy('distanceMeters', 'ASC');

  // filtro opcional de estados
  if (statusIn?.length) {
    qb.andWhere('t.current_status IN (:...st)', { st: statusIn });
  }

  // paginación estándar de tu BaseRepository
  this.paginate(qb, page, limit);

  try {
    // entidades + total con tu wrapper centralizado
    return await this.getManyAndCountSafe(qb, 'findNearbyPickupsEntities');
  } catch (err) {
    handleRepositoryError(this.logger, err, 'findNearbyPickupsEntities', this.entityName);
    throw err;
  }
}
}
