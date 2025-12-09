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
import { TripsQueryDto } from '../dtos/trip/trips-query.dto';
import {
  FareBreakdown,
  TripListItemProjection,
} from '../interfaces/trip.interfaces';

export interface PaginationDto {
  page?: number;
  limit?: number;
}

// (Opcional) tipa las relaciones válidas de forma segura
export const TRIP_RELATIONS = ['passenger', 'driver', 'vehicle'] as const;
// si tienes la relación a la orden, agrégala: 'order'
export type TripRelation = (typeof TRIP_RELATIONS)[number];

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

  /**
   * Construye la cola de prioridad de drivers para un trip.
   * Por ahora NO implementa el algoritmo (placeholder).
   *
   * @param tripId             Trip al que aplica
   * @param pickupPoint        Punto de recogida (WGS84)
   * @param candidateDrivers   Candidatos pre-filtrados (eligibles) del módulo availability
   * @param manager            Opcional: para ejecutar dentro de una TX
   * @returns Lista ordenada (por ahora, tal cual entró)
   */
  async buildPriorityQueueForTrip(
    tripId: string,
    pickupPoint: { lat: number; lng: number },
    candidateDrivers: Array<{ driverId: string; vehicleId: string }>,
    manager?: EntityManager,
  ): Promise<Array<{ driverId: string; vehicleId: string }>> {
    // TODO: implementar algoritmo de priorización (ETA, distancia, rating, tasa de aceptación, tiempo esperando, etc.)
    // - Aquí puedes leer métricas auxiliares con `manager` si se pasa (dentro de una transacción)
    // - Devolver el arreglo ordenado por score cuando lo implementes
    return candidateDrivers;
  }

  /** Obtener por id (cargando relaciones si se pide) */
  async findById(
    id: string,
    opts: { relations?: boolean | Record<string, boolean> } = {
      relations: true,
    },
  ): Promise<Trip | null> {
    try {
      if (opts.relations) {
        return await this.findOne({
          where: { id } as any,
          relations:
            typeof opts.relations === 'boolean'
              ? { passenger: true, driver: true, vehicle: true }
              : (opts.relations as any),
        });
      }
      return await this.findOne({ where: { id } as any });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }

  /** Lock FOR UPDATE y devuelve la fila. */
  async lockByIdForUpdate(
    id: string,
    manager: EntityManager,
  ): Promise<Trip | null> {
    const repo = this.scoped(manager);
    try {
      return await repo
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :id', { id })
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

  /** get con lock pesimista (para transiciones) */
  async findByIdForUpdate(
    id: string,
    manager?: EntityManager,
  ): Promise<Trip | null> {
    try {
      const qb = (
        manager ? manager.getRepository(Trip) : this
      ).createQueryBuilder('t');
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

  async findActiveByDriver(driverId: string): Promise<Trip | null> {
    const active: TripStatus[] = [
      TripStatus.PENDING,
      TripStatus.ASSIGNING,
      TripStatus.ACCEPTED,
      TripStatus.ARRIVING,
      TripStatus.IN_PROGRESS,
    ];
    const qb = this.qb('t')
      .leftJoinAndSelect('t.passenger', 'passenger')
      .leftJoinAndSelect('t.vehicle', 'vehicle')
      .where('t.driver_id = :did', { did: driverId })
      .andWhere('t.current_status IN (:...st)', { st: active })
      .orderBy('t.requested_at', 'DESC')
      .limit(1);

    return this.getOneSafe(qb, 'findActiveByDriver');
  }

  /** Listado paginado con ENTIDADES */
  async findAllPaginated(
    pagination: PaginationDto,
    filters?: TripsQueryDto,
  ): Promise<[Trip[], number]> {
    const { page = 1, limit = 10 } = pagination;

    const qb = this.qb('t')
      .leftJoinAndSelect('t.passenger', 'passenger')
      .leftJoinAndSelect('t.driver', 'driver')
      .leftJoinAndSelect('t.vehicle', 'vehicle')
      .orderBy('t.requested_at', 'DESC');

    if (filters) this.applyFilters(qb, filters);
    this.paginate(qb, page, limit);

    return this.getManyAndCountSafe(qb, 'findAllPaginated');
  }

  /** Listado paginado en PROYECCIÓN (sin relaciones) */
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

  /** Patch con retorno de entidad fresca */
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

  async applyEstimateSnapshotExtended(
    id: string,
    estimate: {
      currency: string;
      surgeMultiplier: number;
      breakdown: FareBreakdown;
      distanceKmEst?: number;
      durationMinEst?: number;
      estimatedTotal?: number; // ← aquí viene el estimado
    },
    manager: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    await repo.update(
      { id } as any,
      {
        fareFinalCurrency: estimate.currency,
        fareSurgeMultiplier: estimate.surgeMultiplier,
        fareBreakdown: estimate.breakdown,
        ...(estimate.distanceKmEst != null && {
          fareDistanceKm: estimate.distanceKmEst,
        }),
        ...(estimate.durationMinEst != null && {
          fareDurationMin: estimate.durationMinEst,
        }),
        ...(estimate.estimatedTotal != null && {
          fareEstimatedTotal: Number(estimate.estimatedTotal.toFixed(2)),
        }),
      } as any,
    );
  }

  /** Aplica snapshot del estimate (moneda, surge, breakdown y total estimado opcional) */
  async applyEstimateSnapshot(
    id: string,
    estimate: {
      currency: string;
      surgeMultiplier: number;
      breakdown: any;
      distanceKmEst?: number;
      durationMinEst?: number;
      estimatedTotal?: number | null; // estimado en fase de solicitud
    },
    manager: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);

    const patch: any = {
      fareFinalCurrency: estimate.currency,
      fareSurgeMultiplier: estimate.surgeMultiplier,
      fareBreakdown: estimate.breakdown,
    };

    if (estimate.distanceKmEst !== undefined) {
      patch.fareDistanceKm = Number(Number(estimate.distanceKmEst).toFixed(3));
    }
    if (estimate.durationMinEst !== undefined) {
      patch.fareDurationMin = Number(
        Number(estimate.durationMinEst).toFixed(2),
      );
    }
    if (estimate.estimatedTotal !== undefined) {
      const t = estimate.estimatedTotal;
      patch.fareEstimatedTotal =
        t === null ? null : Number(Number(t).toFixed(2));
    }

    await repo
      .createQueryBuilder()
      .update()
      .set(patch)
      .where('id = :id', { id })
      .execute();
  }

  /** Transición: pending -> assigning (con lock previo en Service) */
  async moveToAssigningWithLock(
    id: string,
    // assigningStartedAt: Date,
    manager: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    try {
      // precondición: status='pending'
      await repo
        .createQueryBuilder()
        .update()
        .set({
          currentStatus: TripStatus.ASSIGNING,
          // assigningStartedAt,
        } as any)
        .where('id = :id', { id })
        .andWhere('current_status = :st', { st: TripStatus.PENDING })
        .execute();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'moveToAssigningWithLock',
        this.entityName,
      );
    }
  }

  /** Transición: asignar driver => accepted */
  async assignDriver(
    id: string,
    payload: { driverId: string; vehicleId: string; acceptedAt: Date },
    manager: EntityManager,
  ): Promise<void> {
    try {
      // OJO: en la DB la PK se llama "_id" (según tu @PrimaryGeneratedColumn)
      await manager.query(
        `UPDATE trips
         SET driver_id = $2,
             vehicle_id = $3,
             accepted_at = $4,
             current_status = $5,
             updated_at = NOW()
       WHERE _id = $1
         AND current_status = $6`,
        [
          id,
          payload.driverId,
          payload.vehicleId,
          payload.acceptedAt,
          TripStatus.ACCEPTED,
          TripStatus.ASSIGNING,
        ],
      );
    } catch (err) {
      handleRepositoryError(this.logger, err, 'assignDriver', 'Trip');
    }
  }

  async setArriving(
    id: string,
    at: Date,
    etaOrManager: number | null | EntityManager | undefined,
    maybeManager?: EntityManager,
  ): Promise<void> {
    // Detectar si el tercer parámetro es eta o manager
    const hasEta = typeof etaOrManager === 'number' || etaOrManager === null;

    const etaMinutes = hasEta ? etaOrManager : null;
    const manager = hasEta
      ? (maybeManager as EntityManager)
      : (etaOrManager as EntityManager);

    const repo = this.scoped(manager);

    try {
      const patch: any = {
        arrivedPickupAt: at,
        currentStatus: TripStatus.ARRIVING,
      };

      // Si tenemos ETA, calculamos pickup_eta_at
      if (etaMinutes != null) {
        const etaMs = at.getTime() + etaMinutes * 60 * 1000;
        const etaDate = new Date(etaMs);
        patch.pickupEtaAt = etaDate;
      }

      const result = await repo
        .createQueryBuilder()
        .update()
        .set(patch)
        .where('id = :id', { id })
        .andWhere('current_status = :st', { st: TripStatus.ACCEPTED })
        .execute();

      const affected = result.affected ?? 0;
      if (affected === 0) {
        this.logger.warn(
          `[TripRepository] setArriving no modificó filas trip=${id} (posible status != ${TripStatus.ACCEPTED})`,
        );
      } else {
        this.logger.debug(
          `[TripRepository] setArriving OK trip=${id} affected=${affected} at=${at.toISOString()} etaMinutes=${etaMinutes ?? 'null'}`,
        );
      }
    } catch (err) {
      handleRepositoryError(this.logger, err, 'setArriving', this.entityName);
    }
  }

  async getStatusAndDriverForUpdate(
    id: string,
    manager: EntityManager,
  ): Promise<{ status: TripStatus; driverId: string | null } | null> {
    try {
      const rows = await manager.query(
        `
      SELECT current_status, driver_id
      FROM trips
      WHERE _id = $1
      FOR UPDATE
      `,
        [id],
      );

      if (!rows.length) {
        this.logger.warn(
          `[TripRepository] getStatusAndDriverForUpdate no rows id=${id}`,
        );
        return null;
      }

      const row = rows[0];
      const status = row.current_status as TripStatus;
      const driverId = (row.driver_id ?? null) as string | null;

      this.logger.debug(
        `[TripRepository] getStatusAndDriverForUpdate id=${id} status=${status} driverId=${driverId}`,
      );

      return { status, driverId };
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'getStatusAndDriverForUpdate',
        this.entityName,
      );
      throw err;
    }
  }

  async setArrivedPickup(
    id: string,
    at: Date,
    manager: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    try {
      const result = await repo
        .createQueryBuilder()
        .update()
        .set({ arrivedPickupAt: at } as any)
        .where('id = :id', { id })
        .andWhere('current_status IN (:...st)', {
          st: [TripStatus.ACCEPTED, TripStatus.ARRIVING],
        })
        .execute();

      const affected = result.affected ?? 0;
      if (affected === 0) {
        this.logger.warn(
          `setArrivedPickup no modificó filas trip=${id} (status no es accepted/arriving?)`,
        );
      } else {
        this.logger.debug(
          `setArrivedPickup OK trip=${id} affected=${affected} at=${at.toISOString()}`,
        );
      }
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'setArrivedPickup',
        this.entityName,
      );
    }
  }

  async startTrip(id: string, at: Date, manager: EntityManager): Promise<void> {
    const repo = this.scoped(manager);
    try {
      const result = await repo
        .createQueryBuilder()
        .update()
        .set({ startedAt: at, currentStatus: TripStatus.IN_PROGRESS } as any)
        .where('id = :id', { id })
        .andWhere('current_status IN (:...st)', {
          st: [TripStatus.ACCEPTED, TripStatus.ARRIVING],
        })
        .execute();

      const affected = result.affected ?? 0;
      if (affected === 0) {
        this.logger.warn(
          `startTrip no modificó filas trip=${id} (status no es accepted/arriving?)`,
        );
      } else {
        this.logger.debug(
          `startTrip OK trip=${id} affected=${affected} at=${at.toISOString()}`,
        );
      }
    } catch (err) {
      handleRepositoryError(this.logger, err, 'startTrip', this.entityName);
      throw err; // 👈 importante para abortar la TX
    }
  }

  async findByIdWithPricing(
    id: string,
    manager: EntityManager,
  ): Promise<Trip | null> {
    try {
      return await manager.getRepository(Trip).findOne({
        where: { id },
        relations: {
          passenger: true,
          driver: true,
          vehicle: true,
          requestedServiceClass: true,
          estimateVehicleType: { category: true },
        },
      });
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findByIdWithPricing',
        this.entityName,
      );
    }
  }

  async completeTrip(
    id: string,
    totals: {
      distanceKm: number;
      durationMin: number;
      fareTotal: number;
      surgeMultiplier?: number;
      breakdown: any;
      completedAt: Date;
    },
    manager: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    try {
      await repo
        .createQueryBuilder()
        .update()
        .set({
          currentStatus: TripStatus.COMPLETED,
          completedAt: totals.completedAt,
          fareDistanceKm: totals.distanceKm,
          fareDurationMin: totals.durationMin,
          fareTotal: totals.fareTotal,
          ...(totals.surgeMultiplier !== undefined && {
            fareSurgeMultiplier: totals.surgeMultiplier,
          }),
          fareBreakdown: totals.breakdown,
        } as any)
        .where('id = :id', { id })
        .andWhere('current_status = :st', { st: TripStatus.IN_PROGRESS })
        .execute();
    } catch (err) {
      handleRepositoryError(this.logger, err, 'completeTrip', this.entityName);
    }
  }

  async moveToNoDriversFoundWithLock(
    id: string,
    at: Date,
    manager: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    try {
      await repo
        .createQueryBuilder()
        .update()
        .set({ currentStatus: TripStatus.NO_DRIVERS_FOUND } as any)
        .where('id = :id', { id })
        .andWhere('current_status IN (:...st)', {
          st: [TripStatus.ASSIGNING, TripStatus.PENDING],
        })
        .execute();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'moveToNoDriversFoundWithLock',
        this.entityName,
      );
      throw err;
    }
  }

  async cancelTrip(
    id: string,
    at: Date,
    manager: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    try {
      await repo
        .createQueryBuilder()
        .update()
        .set({ canceledAt: at, currentStatus: TripStatus.CANCELLED } as any)
        .where('id = :id', { id })
        .andWhere('current_status != :completed', {
          completed: TripStatus.COMPLETED,
        })
        .execute();
    } catch (err) {
      handleRepositoryError(this.logger, err, 'cancelTrip', this.entityName);
    }
  }

  async setOrderId(
    id: string,
    orderId: string | null,
    manager: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    try {
      await repo.update({ id } as any, { orderId } as any);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'setOrderId', this.entityName);
    }
  }

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

  // --------- helpers privados ----------
  private applyFilters(qb: SelectQueryBuilder<Trip>, f: TripsQueryDto): void {
    if (f.passengerId)
      qb.andWhere('t.passenger_id = :pid', { pid: f.passengerId });
    if (f.driverId) qb.andWhere('t.driver_id = :did', { did: f.driverId });
    if (f.vehicleId) qb.andWhere('t.vehicle_id = :vid', { vid: f.vehicleId });
    if (f.status) qb.andWhere('t.current_status = :st', { st: f.status });
    if (f.paymentMode)
      qb.andWhere('t.payment_mode = :pm', { pm: f.paymentMode });

    if (f.vehicleCategoryId) {
      qb.andWhere('t.requested_vehicle_category_id = :vcid', {
        vcid: f.vehicleCategoryId,
      });
    }
    if (f.serviceClassId) {
      qb.andWhere('t.requested_service_class_id = :scid', {
        scid: f.serviceClassId,
      });
    }

    if (f.requestedFrom)
      qb.andWhere('t.requested_at >= :rf', { rf: f.requestedFrom });
    if (f.requestedTo)
      qb.andWhere('t.requested_at <= :rt', { rt: f.requestedTo });

    if (f.completedFrom)
      qb.andWhere('t.completed_at >= :cf', { cf: f.completedFrom });
    if (f.completedTo)
      qb.andWhere('t.completed_at <= :ct', { ct: f.completedTo });
  }

  private async countWithFilters(filters?: TripsQueryDto): Promise<number> {
    const qb = this.qb('t').select('t.id');
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
    }
  }
}
