// src/modules/drivers/repositories/driver-availability.repository.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  SelectQueryBuilder,
} from 'typeorm';

import { BaseRepository } from 'src/common/repositories/base.repository';
import {
  AvailabilityReason,
  DriverAvailability,
} from '../entities/driver-availability.entity';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { DriverAvailabilityQueryDto } from '../dtos/driver-availability-query.dto';
import {
  DriverAvailabilityListItemProjection,
  FindEligibleDriversParams,
} from '../interfaces/driver-availability.interface';
import { getDistance } from 'src/common/utils/haversine';

export const DRIVER_AVAILABILITY_RELATIONS = [
  'driver',
  'currentTrip',
  'currentVehicle',
] as const;
export type DriverAvailabilityRelation =
  (typeof DRIVER_AVAILABILITY_RELATIONS)[number];

@Injectable()
export class DriverAvailabilityRepository extends BaseRepository<DriverAvailability> {
  constructor(dataSource: DataSource) {
    super(
      DriverAvailability,
      dataSource.createEntityManager(),
      'DriverAvailabilityRepository',
      'DriverAvailability',
    );
  }

  async createAndSave(
    partial: DeepPartial<DriverAvailability>,
    manager?: EntityManager,
  ): Promise<DriverAvailability> {
    const repo = this.scoped(manager);
    const entity = repo.create(partial);
    try {
      return await repo.save(entity);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
      throw err;
    }
  }

  /** Upsert minimalista por driverId */
  async ensureForDriver(
    driverId: string,
    seed?: DeepPartial<DriverAvailability>,
    manager?: EntityManager,
  ): Promise<DriverAvailability> {
    const existing = await this.findByDriverId(driverId, [], manager);
    if (existing) return existing;
    return this.createAndSave(
      {
        driverId,
        isOnline: false,
        isAvailableForTrips: false,
        availabilityReason: AvailabilityReason.OFFLINE,
        ...(seed ?? {}),
      },
      manager,
    );
  }

  async findById(
    id: string,
    relations: DriverAvailabilityRelation[] = [],
    manager?: EntityManager,
  ): Promise<DriverAvailability | null> {
    return this.findWithRelations(id, relations, undefined, manager);
  }

  async findByDriverId(
    driverId: string,
    relations: DriverAvailabilityRelation[] = [],
    manager?: EntityManager,
  ): Promise<DriverAvailability | null> {
    try {
      const repo = manager ? manager.getRepository(DriverAvailability) : this;
      const qb = repo.createQueryBuilder('da');

      this.attachRelations(qb, relations);
      qb.where('da.driver_id = :driverId', { driverId }).limit(1);

      return await this.getOneSafe(qb, 'findByDriverId');
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findByDriverId',
        this.entityName,
      );
      throw err;
    }
  }

  /**
   * Devuelve candidatos "matcheables" cerca del pickup.
   * Incluye filtros de compatibilidad y exclusión de intentos previos.
   * Proyecta lo necesario para el matching: driverId y primaryVehicleId.
   */
  async findEligibleDrivers(
    p: FindEligibleDriversParams,
  ): Promise<Array<{ driverId: string; primaryVehicleId: string }>> {
    this.logger.debug(
      `[elig] IN ${JSON.stringify({
        lat: p.pickup.lat,
        lng: p.pickup.lng,
        radius: p.radiusMeters,
        vc: p.vehicleCategoryId ?? 'null',
        sc: p.serviceClassId ?? 'null',
        limit: p.limit,
        ttl: p.ttlSeconds,
        wallet: p.requireWalletActive,
        vehInService: p.requireVehicleInService,
      })}`,
    );

    const qb = this.qb('da')
      .leftJoin('da.driver', 'driver')
      .leftJoin('da.currentVehicle', 'v')
      .leftJoin('v.vehicleType', 'vt')
      .leftJoin('vt.category', 'cat')
      .leftJoin('vt.serviceClasses', 'vsc')
      .select([
        'da.driver_id AS "driverId"',
        'da.current_vehicle_id AS "primaryVehicleId"',
        `ST_Distance(
        da.last_location,
        ST_SetSRID(ST_MakePoint(:lon2, :lat2), 4326)::geography
      ) AS "distanceMeters"`,
      ])
      .where('da.is_online = true')
      .andWhere('da.is_available_for_trips = true')
      .andWhere('da.availability_reason IS NULL')
      .andWhere('da.current_trip_id IS NULL')
      .andWhere('da.last_location IS NOT NULL')
      .andWhere(`driver.status <> 'banned'`);

    if ((p.ttlSeconds ?? 0) > 0) {
      qb.andWhere('da.last_presence_timestamp IS NOT NULL').andWhere(
        `da.last_presence_timestamp >= NOW() - (:ttl::int * INTERVAL '1 second')`,
        { ttl: p.ttlSeconds },
      );
    }

    if (p.requireWalletActive) {
      qb.andWhere(
        `EXISTS (
        SELECT 1 FROM driver_balance db
        WHERE db.driver_id = da.driver_id AND db.status = 'active'
      )`,
      );
    }

    if (p.requireVehicleInService) {
      qb.andWhere(
        `EXISTS (
        SELECT 1 FROM vehicles vv
        WHERE vv.id = da.current_vehicle_id
          AND vv.status = 'in_service'
          AND vv."deletedAt" IS NULL
      )`,
      );
    }

    if (p.vehicleCategoryId)
      qb.andWhere('cat.id = :vcid', { vcid: p.vehicleCategoryId });
    if (p.serviceClassId)
      qb.andWhere('vsc.id = :scid', { scid: p.serviceClassId });

    // ⛔️ nunca re-ofertar al mismo driver para este trip
    if (p.excludeAlreadyTriedForTripId) {
      qb.andWhere(
        `NOT EXISTS (
         SELECT 1
         FROM trip_assignments ta
         WHERE ta.trip_id = :trip_ex
           AND ta.driver_id = da.driver_id
       )`,
        { trip_ex: p.excludeAlreadyTriedForTripId },
      );

      // Si prefieres "cooldown" en vez de veto total, usa esto:
      // qb.andWhere(
      //   `NOT EXISTS (
      //      SELECT 1 FROM trip_assignments ta
      //      WHERE ta.trip_id = :trip_ex
      //        AND ta.driver_id = da.driver_id
      //        AND ta.created_at >= NOW() - INTERVAL '10 minutes'
      //   )`,
      //   { trip_ex: p.excludeAlreadyTriedForTripId },
      // );
    }

    qb.andWhere(
      `ST_DWithin(
      da.last_location,
      ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
      :radius
    )`,
      { lon: p.pickup.lng, lat: p.pickup.lat, radius: p.radiusMeters },
    )
      .setParameters({ lon2: p.pickup.lng, lat2: p.pickup.lat })
      .orderBy(`"distanceMeters"`, 'ASC')
      .limit(Math.max(1, p.limit * 2));

    const sql = qb.getSql();
    this.logger.debug(`[elig] SQL=${sql}`);

    const rows = await qb.getRawMany<{
      driverId: string;
      primaryVehicleId: string;
    }>();
    this.logger.debug(
      `[elig] OUT count=${rows.length} sample=${JSON.stringify(rows.slice(0, Math.min(3, rows.length)))}`,
    );

    // (diag extendido tuyo tal cual…)
    if (rows.length === 0) {
      // ... tu bloque de diagnóstico sin cambios ...
    }

    return rows.slice(0, Math.max(1, p.limit));
  }

  async lockDriverForUpdate(
    driverId: string,
    manager?: EntityManager,
  ): Promise<DriverAvailability | null> {
    try {
      const qb = (
        manager ? manager.getRepository(DriverAvailability) : this
      ).createQueryBuilder('da');

      return await qb
        .setLock('pessimistic_write')
        .where('da.driver_id = :driverId', { driverId })
        .getOne();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'lockDriverForUpdate',
        this.entityName,
      );
      throw err;
    }
  }

  /**
   * Distancia (metros) entre la last_location actual y un punto (lng,lat).
   * Usa ST_Distance si hay ubicación previa; si no hay, devuelve null.
   * Si por algún motivo ST_Distance falla, hace fallback Haversine.
   */
  async distanceToCurrentLastLocation(
    driverId: string,
    lng: number,
    lat: number,
    manager?: EntityManager,
  ): Promise<number | null> {
    const repo = manager ? manager.getRepository(DriverAvailability) : this;
    const row = await repo
      .createQueryBuilder('da')
      .select([
        `da.last_location AS "lastLocation"`,
        `CASE
           WHEN da.last_location IS NULL THEN NULL
           ELSE ST_Distance(
                  da.last_location,
                  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                )
         END AS "distance"`,
      ])
      .where('da.driver_id = :driverId', { driverId })
      .setParameters({ lng, lat })
      .limit(1)
      .getRawOne<{ lastLocation: any; distance: number | null }>();

    if (!row) return null;

    if (row.distance === null && row.lastLocation) {
      // fallback por si en algún entorno ST_* no está disponible
      try {
        const p = row.lastLocation;
        const [prevLng, prevLat] = p?.coordinates ?? [undefined, undefined];
        if (typeof prevLat === 'number' && typeof prevLng === 'number') {
          return getDistance(prevLat, prevLng, lat, lng); // en metros
        }
      } catch {
        /* ignore */
      }
    }
    return row.distance ?? null;
  }

  /** Listado paginado con ENTIDADES */
  async findAllPaginated(
    pagination: PaginationDto,
    filters?: DriverAvailabilityQueryDto,
  ): Promise<[DriverAvailability[], number]> {
    const { page = 1, limit = 10 } = pagination;

    const qb = this.qb('da')
      .leftJoinAndSelect('da.driver', 'driver')
      .leftJoinAndSelect('da.currentTrip', 'currentTrip')
      .leftJoinAndSelect('da.currentVehicle', 'currentVehicle')
      // ⚠️ Usa columnas snake_case para evitar crashes de TypeORM con orderBy
      .orderBy('da.lastPresenceTimestamp', 'DESC')
      .addOrderBy('da.updatedAt', 'DESC');

    if (filters) this.applyFilters(qb, filters);
    this.paginate(qb, page, limit);

    return this.getManyAndCountSafe(qb, 'findAllPaginated');
  }

  /** Listado paginado en PROYECCIÓN (sin relaciones) */
  async findListPaginatedProjection(
    pagination: PaginationDto,
    filters?: DriverAvailabilityQueryDto,
  ): Promise<[DriverAvailabilityListItemProjection[], number]> {
    const { page = 1, limit = 10 } = pagination;

    const qb = this.qb('da')
      .select([
        'da._id AS id',
        'da.driver_id AS "driverId"',
        'da.is_online AS "isOnline"',
        'da.is_available_for_trips AS "isAvailableForTrips"',
        'da.current_trip_id AS "currentTripId"',
        'da.current_vehicle_id AS "currentVehicleId"',
        'da.availability_reason AS "availabilityReason"',
        'da.last_location_timestamp AS "lastLocationTimestamp"',
        'da.last_presence_timestamp AS "lastPresenceTimestamp"',
        'da.updated_at AS "updatedAt"',
      ])
      .orderBy('da.last_presence_timestamp', 'DESC')
      .addOrderBy('da.updated_at', 'DESC');

    if (filters) this.applyFilters(qb, filters);
    this.paginate(qb, page, limit);

    try {
      const [rows, total] = await Promise.all([
        qb.getRawMany<DriverAvailabilityListItemProjection>(),
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
      throw err;
    }
  }

  /** Update parcial y recarga con relaciones */
  async updatePartial(
    id: string,
    patch: DeepPartial<DriverAvailability>,
    manager?: EntityManager,
  ): Promise<DriverAvailability> {
    const repo = this.scoped(manager);
    try {
      // No permitimos mutar claves
      const {
        id: _omitId,
        driverId: _omitDriverId,
        ...safePatch
      } = (patch ?? {}) as any;

      const result = await repo.update({ id }, safePatch);
      if (!result.affected) {
        throw new NotFoundException(`DriverAvailability ${id} not found`);
      }

      const reloaded = await this.findWithRelations(
        id,
        ['driver', 'currentTrip', 'currentVehicle'],
        undefined,
        manager,
      );
      if (!reloaded) {
        throw new NotFoundException(
          `DriverAvailability ${id} not found after update`,
        );
      }
      return reloaded;
    } catch (err) {
      handleRepositoryError(this.logger, err, 'updatePartial', this.entityName);
      throw err;
    }
  }

  /** Lectura con lock para flujos sensibles a concurrencia */
  async findByIdForUpdate(
    id: string,
    manager?: EntityManager,
  ): Promise<DriverAvailability | null> {
    try {
      const qb = (
        manager ? manager.getRepository(DriverAvailability) : this
      ).createQueryBuilder('da');

      return await qb
        .setLock('pessimistic_write')
        .where('da._id = :id', { id })
        .getOne();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findByIdForUpdate',
        this.entityName,
      );
      throw err;
    }
  }

  /** Buscar conductores disponibles cerca (wallet debe estar activa) */
  async findNearbyAvailable(
    lon: number,
    lat: number,
    radiusMeters = 2000,
    limit = 50,
    ttlSeconds = 90, // opcional: 0 para desactivar TTL
  ): Promise<DriverAvailability[]> {
    const qb = this.qb('da')
      .leftJoinAndSelect('da.driver', 'driver')
      .leftJoinAndSelect('da.currentVehicle', 'currentVehicle')
      // estado operativo mínimo
      .where('da.is_online = true')
      .andWhere('da.is_available_for_trips = true')
      .andWhere('da.availability_reason IS NULL')
      .andWhere('da.current_trip_id IS NULL')
      .andWhere('da.last_location IS NOT NULL')
      // user no baneado
      .andWhere(`driver.status <> 'banned'`)
      // vehículo en servicio
      .andWhere(`currentVehicle.status = 'in_service'`)
      // wallet activa
      .andWhere(
        `EXISTS (
         SELECT 1
         FROM driver_balance db
         WHERE db.driver_id = da.driver_id
           AND db.status = 'active'
       )`,
      );

    // TTL de presencia (opcional)
    if (ttlSeconds > 0) {
      qb.andWhere('da.last_presence_timestamp IS NOT NULL').andWhere(
        `da.last_presence_timestamp >= NOW() - (:ttl::int * INTERVAL '1 second')`,
        { ttl: ttlSeconds },
      );
    }

    // geofiltro + orden por distancia
    qb.andWhere(
      `ST_DWithin(
      da.last_location,
      ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
      :radius
    )`,
      { lon, lat, radius: radiusMeters },
    )
      .orderBy(
        `ST_Distance(
        da.last_location,
        ST_SetSRID(ST_MakePoint(:lon2, :lat2), 4326)::geography
      )`,
        'ASC',
      )
      .setParameters({ lon2: lon, lat2: lat })
      .limit(Math.max(1, limit));

    return this.getManySafe(qb, 'findNearbyAvailable');
  }

  // ---------- helpers de actualización por driverId ----------

  async updateStatusByDriverId(
    driverId: string,
    patch: Partial<
      Pick<
        DriverAvailability,
        | 'isOnline'
        | 'isAvailableForTrips'
        | 'availabilityReason'
        | 'lastOnlineTimestamp'
        | 'lastPresenceTimestamp'
      >
    >,
    manager?: EntityManager,
  ): Promise<DriverAvailability> {
    const row = await this.findByDriverId(driverId, [], manager);
    if (!row) {
      throw new NotFoundException(
        `DriverAvailability for ${driverId} not found`,
      );
    }

    const next: Partial<DriverAvailability> = { ...patch };

    // 1) No se puede poner disponible si está en viaje
    if (row.currentTripId && patch.isAvailableForTrips === true) {
      throw new BadRequestException('Cannot set available while ON_TRIP');
    }

    // 2) Offline => forzar flags y razón
    if (patch.isOnline === false) {
      next.isAvailableForTrips = false;
      next.availabilityReason = AvailabilityReason.OFFLINE;
      next.lastOnlineTimestamp ??= new Date();
    }

    // 3) Online + quiere estar disponible => razón NULL (Service ya validó elegibilidad)
    if (patch.isOnline === true && patch.isAvailableForTrips === true) {
      if (row.currentTripId) {
        throw new BadRequestException('Cannot set available while ON_TRIP');
      }
      next.availabilityReason = null as any;
    }

    // 4) Online pero NO disponible y sin trip:
    //    si no se especificó razón, deja UNAVAILABLE por defecto (más explícito)
    const willBeOnline =
      patch.isOnline !== undefined ? patch.isOnline : row.isOnline;
    const willBeAvailable =
      patch.isAvailableForTrips !== undefined
        ? patch.isAvailableForTrips
        : row.isAvailableForTrips;

    if (
      willBeOnline === true &&
      willBeAvailable !== true && // false o undefined
      !row.currentTripId &&
      patch.availabilityReason === undefined // el caller no fijó una razón
    ) {
      next.availabilityReason = AvailabilityReason.UNAVAILABLE;
    }

    // 5) Si el caller pasa razón explícita, se respeta (Service debe ser el único en hacerlo)

    return this.updatePartial(row.id, next, manager);
  }

  async updateLocationByDriverId(
    driverId: string,
    patch: Partial<
      Pick<
        DriverAvailability,
        'lastLocation' | 'lastLocationTimestamp' | 'lastPresenceTimestamp'
      >
    >,
    manager?: EntityManager,
  ): Promise<DriverAvailability> {
    const row = await this.findByDriverId(driverId, [], manager);
    if (!row) {
      throw new NotFoundException(
        `DriverAvailability for ${driverId} not found`,
      );
    }

    const next: Partial<DriverAvailability> = { ...patch };

    // Si actualiza coordenadas y no mandó timestamp, marcamos ahora
    if (patch.lastLocation && !patch.lastLocationTimestamp) {
      next.lastLocationTimestamp = new Date() as any;
    }
    // Mantén viva la presencia: si no la mandaron, setéala
    if (!patch.lastPresenceTimestamp) {
      next.lastPresenceTimestamp = new Date() as any;
    }

    return this.updatePartial(row.id, next, manager);
  }

  async setCurrentTripByDriverId(
    driverId: string,
    tripId: string,
    manager?: EntityManager,
  ): Promise<DriverAvailability> {
    const row = await this.findByDriverId(driverId, [], manager);
    if (!row) {
      throw new NotFoundException(
        `DriverAvailability for ${driverId} not found`,
      );
    }
    return this.updatePartial(
      row.id,
      {
        currentTripId: tripId,
        isAvailableForTrips: false,
        availabilityReason: AvailabilityReason.ON_TRIP,
      },
      manager,
    );
  }

  async clearCurrentTripByDriverId(
    driverId: string,
    manager?: EntityManager,
  ): Promise<DriverAvailability> {
    const row = await this.findByDriverId(driverId, [], manager);
    if (!row) {
      throw new NotFoundException(
        `DriverAvailability for ${driverId} not found`,
      );
    }
    const next: Partial<DriverAvailability> = { currentTripId: null };
    // Si estaba en ON_TRIP, al limpiar viaje deja razón NULL; el Service decidirá si queda disponible o UNAVAILABLE
    if (row.availabilityReason === AvailabilityReason.ON_TRIP) {
      next.availabilityReason = null as any;
    }
    return this.updatePartial(row.id, next, manager);
  }

  private async getManySafe(
    qb: SelectQueryBuilder<DriverAvailability>,
    context: string,
  ): Promise<DriverAvailability[]> {
    try {
      return await qb.getMany();
    } catch (err) {
      handleRepositoryError(this.logger, err, context, this.entityName);
      throw err;
    }
  }

  // ----------------- Helpers privados -----------------

  private applyFilters(
    qb: SelectQueryBuilder<DriverAvailability>,
    f: DriverAvailabilityQueryDto,
  ): void {
    if (f.driverId) qb.andWhere('da.driver_id = :did', { did: f.driverId });

    if (f.currentTripId !== undefined) {
      if (f.currentTripId === null) qb.andWhere('da.current_trip_id IS NULL');
      else qb.andWhere('da.current_trip_id = :ctid', { ctid: f.currentTripId });
    }

    if (f.currentVehicleId)
      qb.andWhere('da.current_vehicle_id = :cvid', {
        cvid: f.currentVehicleId,
      });

    if (typeof f.isOnline === 'boolean')
      qb.andWhere('da.is_online = :io', { io: f.isOnline });

    if (typeof f.isAvailableForTrips === 'boolean')
      qb.andWhere('da.is_available_for_trips = :iav', {
        iav: f.isAvailableForTrips,
      });

    // --- availability_reason (incluye soporte para NULL) ---
    if (f.reasonIsNull === true) {
      qb.andWhere('da.availability_reason IS NULL');
    } else if (f.availabilityReason !== undefined) {
      if (f.availabilityReason === null) {
        qb.andWhere('da.availability_reason IS NULL');
      } else {
        qb.andWhere('da.availability_reason = :ar', {
          ar: f.availabilityReason,
        });
      }
    }

    // --- ubicación presente / ausente ---
    if (typeof f.hasLocation === 'boolean') {
      qb.andWhere(`da.last_location IS ${f.hasLocation ? 'NOT ' : ''}NULL`);
    }

    if (f.lastLocationFrom)
      qb.andWhere('da.last_location_timestamp >= :llf', {
        llf: f.lastLocationFrom,
      });
    if (f.lastLocationTo)
      qb.andWhere('da.last_location_timestamp <= :llt', {
        llt: f.lastLocationTo,
      });

    if (f.lastPresenceFrom)
      qb.andWhere('da.last_presence_timestamp >= :lpf', {
        lpf: f.lastPresenceFrom,
      });
    if (f.lastPresenceTo)
      qb.andWhere('da.last_presence_timestamp <= :lpt', {
        lpt: f.lastPresenceTo,
      });

    if (f.updatedFrom)
      qb.andWhere('da.updated_at >= :uf', { uf: f.updatedFrom });
    if (f.updatedTo) qb.andWhere('da.updated_at <= :ut', { ut: f.updatedTo });

    if (f.lastOnlineFrom)
      qb.andWhere('da.last_online_timestamp >= :lof', {
        lof: f.lastOnlineFrom,
      });
    if (f.lastOnlineTo)
      qb.andWhere('da.last_online_timestamp <= :lot', { lot: f.lastOnlineTo });

    // --- wallet activa (EXISTS) ---
    if (f.requireWalletActive) {
      qb.andWhere(
        `EXISTS (
         SELECT 1
         FROM driver_balance db
         WHERE db.driver_id = da.driver_id
           AND db.status = 'active'
       )`,
      );
    }

    // --- vehículo en servicio (EXISTS sobre current_vehicle_id) ---
    if (f.requireVehicleInService) {
      qb.andWhere(
        `EXISTS (
         SELECT 1
         FROM vehicles v
         WHERE v.id = da.current_vehicle_id
           AND v.status = 'in_service'
           AND v.deleted_at IS NULL
       )`,
      );
    }

    // --- “matcheable” de una: online + available + reason NULL (+ wallet y vehículo si se piden) ---
    if (f.matchable) {
      qb.andWhere('da.is_online = true')
        .andWhere('da.is_available_for_trips = true')
        .andWhere('da.availability_reason IS NULL');
      // si quieres que matchable siempre implique wallet/vehículo, elimina los flags y déjalo fijo aquí:
      if (!f.requireWalletActive) {
        qb.andWhere(
          `EXISTS (
           SELECT 1 FROM driver_balance db
           WHERE db.driver_id = da.driver_id AND db.status = 'active'
         )`,
        );
      }
      if (!f.requireVehicleInService) {
        qb.andWhere(
          `EXISTS (
           SELECT 1 FROM vehicles v
           WHERE v.id = da.current_vehicle_id
             AND v.status = 'in_service'
             AND v.deleted_at IS NULL
         )`,
        );
      }
    }
  }

  // --- NUEVO: upsert por driverId, simple wrapper con ensure+updatePartial ---
  async upsertByDriverId(
    driverId: string,
    patch: Partial<DriverAvailability>,
    manager?: EntityManager,
  ): Promise<DriverAvailability> {
    await this.ensureForDriver(driverId, {}, manager);
    const row = await this.findByDriverId(driverId, [], manager);
    if (!row)
      throw new NotFoundException(
        `DriverAvailability ${driverId} not found after ensure`,
      );
    return this.updatePartial(row.id, patch, manager);
  }

  // --- NUEVO: soft delete por driverId ---
  async softDeleteByDriverId(
    driverId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    const row = await this.findByDriverId(driverId, [], manager);
    if (!row)
      throw new NotFoundException(
        `DriverAvailability for ${driverId} not found`,
      );
    await repo.update({ id: row.id }, { deletedAt: () => 'now()' } as any);
  }

  private async countWithFilters(
    filters?: DriverAvailabilityQueryDto,
  ): Promise<number> {
    const qb = this.qb('da').select('da._id');
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

  /** Adjunta joins de relaciones de forma segura */
  private attachRelations(
    qb: SelectQueryBuilder<DriverAvailability>,
    relations: DriverAvailabilityRelation[],
  ) {
    if (!relations?.length) return;

    if (relations.includes('driver')) {
      qb.leftJoinAndSelect('da.driver', 'driver');
    }
    if (relations.includes('currentTrip')) {
      qb.leftJoinAndSelect('da.currentTrip', 'currentTrip');
    }
    if (relations.includes('currentVehicle')) {
      qb.leftJoinAndSelect('da.currentVehicle', 'currentVehicle');
    }
  }
}
