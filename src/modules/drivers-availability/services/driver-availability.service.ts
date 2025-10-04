import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DriverAvailabilityRepository } from '../repositories/driver-availability.repository';
import { DriverAvailabilityQueryDto } from '../dtos/driver-availability-query.dto';
import { DriverAvailabilityResponseDto } from '../dtos/driver-availability-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { paginated } from 'src/common/utils/response-helpers';
import {
  AvailabilityReason,
  DriverAvailability,
} from '../entities/driver-availability.entity';
import { DataSource, EntityManager } from 'typeorm';
import { CreateDriverAvailabilityDto } from '../dtos/create-driver-availability.dto';
import { toGeoPoint } from 'src/common/utils/geo.utils';
import { UserRepository } from 'src/modules/user/repositories/user.repository';
import { DriverProfileRepository } from 'src/modules/driver-profiles/repositories/driver-profile.repository';
import { VehicleRepository } from 'src/modules/vehicles/repositories/vehicle.repository';
import { DriverBalanceRepository } from 'src/modules/driver_balance/repositories/driver_balance.repository';
import { UserStatus, UserType } from 'src/modules/user/entities/user.entity';
import { VehicleStatus } from 'src/modules/vehicles/entities/vehicle.entity';
import { DriverStatus } from 'src/modules/driver-profiles/entities/driver-profile.entity';
import { UpsertDriverAvailabilityDto } from '../dtos/driver-availability-upsert.dto';
import { UpdateDriverStatusDto } from '../dtos/update-status.dto';
import { UpdateDriverLocationDto } from '../dtos/update-location.dto';
import { UpdateDriverTripDto } from '../dtos/update-trip.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DriverAvailabilityEvents,
  LocationUpdatedEvent,
  StatusUpdatedEvent,
  TripUpdatedEvent,
} from '../../../core/domain/events/driver-availability.events';

@Injectable()
export class DriverAvailabilityService {
  private readonly logger = new Logger(DriverAvailabilityService.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly driverAvailabilityRepo: DriverAvailabilityRepository,
    private readonly userRepo: UserRepository,
    private readonly driverProfilesRepo: DriverProfileRepository,
    private readonly vehiclesRepo: VehicleRepository,
    private readonly driverBalanceRepo: DriverBalanceRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(
    q: DriverAvailabilityQueryDto,
  ): Promise<
    ApiResponseDto<DriverAvailabilityResponseDto[], PaginationMetaDto>
  > {
    const { page = 1, limit = 10 } = q;

    // 1) Repo: entidades + relaciones (driver/currentTrip/currentVehicle)
    const [entities, total] =
      await this.driverAvailabilityRepo.findAllPaginated({ page, limit }, q);

    // 2) Mapeo a DTO de salida
    const items = entities.map(toDriverAvailabilityResponseDto);

    // 3) Envelope estandarizado con meta
    return paginated(
      items,
      total,
      page,
      limit,
      'Driver availabilities retrieved',
    );
  }

  // ----------------- CREATE -----------------
  async create(
    dto: CreateDriverAvailabilityDto,
  ): Promise<DriverAvailabilityResponseDto> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // 1) Validar usuario
      const user = await this.userRepo.findById(dto.driverId);
      if (!user || user.userType !== UserType.DRIVER) {
        throw new NotFoundException(`Driver ${dto.driverId} no existe`);
      }

      // 2) Asegurar fila OFFLINE si no existe (idempotente)
      await this.driverAvailabilityRepo.ensureForDriver(
        dto.driverId,
        {},
        qr.manager,
      );

      // 3) Releer la fila (id real en esta TX)
      const row = await this.driverAvailabilityRepo.findByDriverId(
        dto.driverId,
        [],
        qr.manager,
      );
      if (!row)
        throw new NotFoundException(
          `DriverAvailability for ${dto.driverId} not found after ensure`,
        );

      // 4) Construir patch a partir del DTO (el server decide la razón final)
      const wantsOnline = dto.isOnline === true;
      const wantsAvailable = dto.isAvailableForTrips === true; // puede venir undefined

      const patch: Partial<DriverAvailability> = {
        isOnline: wantsOnline,
        isAvailableForTrips: wantsAvailable && wantsOnline, // valor inicial; luego lo recalculamos si es elegible
        ...(dto.lastLocation && {
          lastLocation: toGeoPoint(dto.lastLocation.lat, dto.lastLocation.lng),
        }),
        ...(dto.lastLocationTimestamp && {
          lastLocationTimestamp: new Date(dto.lastLocationTimestamp),
        }),
        ...(dto.currentTripId !== undefined && {
          currentTripId: dto.currentTripId,
        }),
        ...(dto.currentVehicleId !== undefined && {
          currentVehicleId: dto.currentVehicleId,
        }),
        ...(dto.lastOnlineTimestamp && {
          lastOnlineTimestamp: new Date(dto.lastOnlineTimestamp),
        }),
        ...(wantsOnline && { lastPresenceTimestamp: new Date() }),
      };

      // Normalizaciones rápidas
      if (patch.isAvailableForTrips && !patch.isOnline) {
        patch.isAvailableForTrips = false;
      }
      if (patch.currentTripId) {
        // si hay trip ⇒ ON_TRIP manda
        patch.isAvailableForTrips = false;
        patch.availabilityReason = AvailabilityReason.ON_TRIP;
      }

      // 5) Elegibilidad (wallet + profile + vehicle in_service) solo si intenta operar y no está en trip
      if ((wantsOnline || wantsAvailable) && !patch.currentTripId) {
        const elig = await this.checkOperationalEligibility(
          dto.driverId,
          patch.currentVehicleId ?? null,
          qr.manager,
        );

        if (!elig.ok) {
          // puede quedar online (presencia), pero no matching
          patch.isOnline = wantsOnline;
          patch.isAvailableForTrips = false;
          patch.availabilityReason = AvailabilityReason.UNAVAILABLE;
        } else {
          // sincroniza vehículo si no vino y hay uno válido
          if (wantsOnline && !patch.currentVehicleId && elig.vehicleId) {
            patch.currentVehicleId = elig.vehicleId;
          }

          // 🔴 REGLA: online + elegible ⇒ available=true, reason=NULL (a menos que el cliente pida explícitamente NO estar disponible)
          if (wantsOnline) {
            const clientExplicitNoAvailable = dto.isAvailableForTrips === false;
            patch.isAvailableForTrips = clientExplicitNoAvailable
              ? false
              : true;
            patch.availabilityReason = patch.isAvailableForTrips
              ? null
              : AvailabilityReason.UNAVAILABLE;
          }
        }
      }

      // 6) Si queda OFFLINE y sin trip ⇒ OFFLINE explícito
      if (!patch.isOnline && !patch.currentTripId) {
        patch.isAvailableForTrips = false;
        patch.availabilityReason = AvailabilityReason.OFFLINE;
      }

      // 7) Un solo write definitivo
      const saved = await this.driverAvailabilityRepo.updatePartial(
        row.id,
        patch,
        qr.manager,
      );

      await qr.commitTransaction();
      return toDriverAvailabilityResponseDto(saved);
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ********
  async createWithinTx(
    dto: CreateDriverAvailabilityDto,
    manager: EntityManager,
  ): Promise<DriverAvailabilityResponseDto> {
    // 1) Validar usuario
    const user = await this.userRepo.findById(dto.driverId);
    if (!user || user.userType !== UserType.DRIVER) {
      throw new NotFoundException(`Driver ${dto.driverId} no existe`);
    }

    // 2) Asegurar fila OFFLINE si no existe (idempotente)
    await this.driverAvailabilityRepo.ensureForDriver(
      dto.driverId,
      {},
      manager,
    );

    // 3) Releer la fila (id real en esta TX)
    const row = await this.driverAvailabilityRepo.findByDriverId(
      dto.driverId,
      [],
      manager,
    );
    if (!row)
      throw new NotFoundException(
        `DriverAvailability for ${dto.driverId} not found after ensure`,
      );

    // 4) Construir patch a partir del DTO
    const wantsOnline = dto.isOnline === true;
    const wantsAvailable = dto.isAvailableForTrips === true;

    const patch: Partial<DriverAvailability> = {
      isOnline: wantsOnline,
      isAvailableForTrips: wantsAvailable && wantsOnline,
      ...(dto.lastLocation && {
        lastLocation: toGeoPoint(dto.lastLocation.lat, dto.lastLocation.lng),
      }),
      ...(dto.lastLocationTimestamp && {
        lastLocationTimestamp: new Date(dto.lastLocationTimestamp),
      }),
      ...(dto.currentTripId !== undefined && {
        currentTripId: dto.currentTripId,
      }),
      ...(dto.currentVehicleId !== undefined && {
        currentVehicleId: dto.currentVehicleId,
      }),
      ...(dto.lastOnlineTimestamp && {
        lastOnlineTimestamp: new Date(dto.lastOnlineTimestamp),
      }),
      ...(wantsOnline && { lastPresenceTimestamp: new Date() }),
    };

    // Normalizaciones
    if (patch.isAvailableForTrips && !patch.isOnline) {
      patch.isAvailableForTrips = false;
    }
    if (patch.currentTripId) {
      patch.isAvailableForTrips = false;
      patch.availabilityReason = AvailabilityReason.ON_TRIP;
    }

    // 5) Elegibilidad (wallet + profile + vehicle in_service) si intenta operar y no está en trip
    if ((wantsOnline || wantsAvailable) && !patch.currentTripId) {
      const elig = await this.checkOperationalEligibility(
        dto.driverId,
        patch.currentVehicleId ?? null,
        manager,
      );

      if (!elig.ok) {
        patch.isOnline = wantsOnline; // presencia ok
        patch.isAvailableForTrips = false;
        patch.availabilityReason = AvailabilityReason.UNAVAILABLE;
      } else {
        if (wantsOnline && !patch.currentVehicleId && elig.vehicleId) {
          patch.currentVehicleId = elig.vehicleId;
        }
        // REGLA: online + elegible ⇒ available=true, reason=NULL (salvo que el cliente pida NO available)
        if (wantsOnline) {
          const clientExplicitNoAvailable = dto.isAvailableForTrips === false;
          patch.isAvailableForTrips = clientExplicitNoAvailable ? false : true;
          patch.availabilityReason = patch.isAvailableForTrips
            ? null
            : AvailabilityReason.UNAVAILABLE;
        }
      }
    }

    // 6) OFFLINE explícito si no está online y no hay trip
    if (!patch.isOnline && !patch.currentTripId) {
      patch.isAvailableForTrips = false;
      patch.availabilityReason = AvailabilityReason.OFFLINE;
    }

    // 7) Un solo write definitivo
    const saved = await this.driverAvailabilityRepo.updatePartial(
      row.id,
      patch,
      manager,
    );
    return toDriverAvailabilityResponseDto(saved);
  }

  /**
   * Llamada al completar un viaje:
   * - libera current_trip_id
   * - si está online, re-evalúa elegibilidad ⇒ set is_available_for_trips & reason
   */
  async onTripEnded(
    driverId: string,
    currentVehicleId: string | null,
    manager?: EntityManager,
  ): Promise<void> {
    // 1) Lock (consistencia)
    const av = await this.driverAvailabilityRepo.lockDriverForUpdate(
      driverId,
      manager,
    );
    if (!av) return;

    // 2) Limpiar el current_trip_id con el método del repo (NO uses updateStatusByDriverId para esto)
    await this.driverAvailabilityRepo.clearCurrentTripByDriverId(
      driverId,
      manager,
    );

    // 3) Recalcular flags de disponibilidad
    let isAvailableForTrips = false;
    let reason: AvailabilityReason | null = AvailabilityReason.OFFLINE;

    if (av.isOnline) {
      const { ok } = await this.checkOperationalEligibility(
        driverId,
        currentVehicleId,
        manager,
      );
      isAvailableForTrips = !!ok;
      reason = ok ? null : AvailabilityReason.UNAVAILABLE;
    } else {
      isAvailableForTrips = false;
      reason = AvailabilityReason.OFFLINE;
    }

    // 4) Actualizar SOLO los campos permitidos por updateStatusByDriverId
    await this.driverAvailabilityRepo.updateStatusByDriverId(
      driverId,
      {
        isOnline: av.isOnline,
        isAvailableForTrips,
        availabilityReason: reason,
        lastPresenceTimestamp: new Date(),
        // <- NO currentTripId aquí
      },
      manager,
    );
  }

  // ****

  /**
   * Elegibilidad operativa:
   * - users.status != banned
   * - driver_profiles.is_approved = true && driver_status = 'active'
   * - driver_balance.status = 'active'
   * - current_vehicle_id existe, está 'in_service' y pertenece al driver (por user o por driverProfile)
   */
  private async checkOperationalEligibility(
    driverId: string,
    currentVehicleId: string | null,
    manager?: EntityManager,
  ): Promise<{ ok: boolean; vehicleId: string | null }> {
    // 1) User: driver y no banned
    const user = await this.userRepo.findById(driverId);
    const userOk =
      !!user &&
      user.userType === UserType.DRIVER &&
      user.status !== UserStatus.BANNED;

    // 2) Perfil + Wallet (usando SOLO repos)
    const [profile, walletActive] = await Promise.all([
      this.driverProfilesRepo.findByUserIdForEligibility(driverId, manager), // { id, isApproved, driverStatus }
      this.driverBalanceRepo.isActiveByDriverId(driverId, manager), // boolean
    ]);

    const profileOk =
      !!profile &&
      profile.isApproved === true &&
      profile.driverStatus === DriverStatus.ACTIVE;

    // 3) Vehículo: debe existir, estar IN_SERVICE y pertenecer al driver
    let vehicleOk = false;
    let vehicleId: string | null = null;

    if (currentVehicleId) {
      const vehicle = await this.vehiclesRepo.findById(currentVehicleId); // relations: ['driver','driverProfile','vehicleType']

      const isInService: boolean = vehicle?.status === VehicleStatus.IN_SERVICE;

      // Pertenencia por user
      const belongsByUser: boolean =
        !!vehicle?.driver && vehicle.driver.id === driverId;

      // Pertenencia por driverProfile (convertir a boolean SIN arrastrar string/undefined)
      const profileId: string | null = profile?.id ?? null;
      const belongsByProfile: boolean =
        (profileId !== null &&
          !!vehicle?.driverProfile &&
          vehicle.driverProfile.id === profileId) ||
        (profileId !== null &&
          !!(vehicle as any)?.driverProfileId &&
          (vehicle as any).driverProfileId === profileId);

      vehicleOk =
        !!vehicle && isInService && (belongsByUser || belongsByProfile);
      vehicleId = vehicleOk ? vehicle!.id : null;
    } else {
      vehicleOk = false;
      vehicleId = null;
    }

    const ok = userOk && profileOk && walletActive && vehicleOk;
    return { ok, vehicleId };
  }

  // DETAIL by driverId
  async findByDriver(driverId: string): Promise<DriverAvailabilityResponseDto> {
    const row = await this.driverAvailabilityRepo.findByDriverId(driverId, [
      'driver',
      'currentTrip',
      'currentVehicle',
    ]);
    if (!row)
      throw new NotFoundException(
        `DriverAvailability for ${driverId} not found`,
      );
    return toDriverAvailabilityResponseDto(row);
  }

  // NEARBY (matching simple)
  async findNearby(
    lat: number,
    lng: number,
    radiusMeters = 2000,
    limit = 50,
    ttlSeconds = 90,
  ) {
    // repo espera lon/lat
    const list = await this.driverAvailabilityRepo.findNearbyAvailable(
      lng,
      lat,
      radiusMeters,
      limit,
      ttlSeconds,
    );
    return list.map(toDriverAvailabilityResponseDto);
  }

  // UPSERT (idempotente)
  async upsert(
    dto: UpsertDriverAvailabilityDto,
  ): Promise<DriverAvailabilityResponseDto> {
    // construimos el patch igual que en create(), pero SIN validar toda la elegibilidad (Fase 1: estable http)
    const patch: any = {};
    if (dto.isOnline !== undefined) patch.isOnline = dto.isOnline;
    if (dto.isAvailableForTrips !== undefined)
      patch.isAvailableForTrips = dto.isAvailableForTrips;
    if (dto.lastLocation)
      patch.lastLocation = toGeoPoint(
        dto.lastLocation.lat,
        dto.lastLocation.lng,
      );
    if (dto.lastLocationTimestamp)
      patch.lastLocationTimestamp = new Date(dto.lastLocationTimestamp);
    if (dto.lastOnlineTimestamp)
      patch.lastOnlineTimestamp = new Date(dto.lastOnlineTimestamp);
    if (dto.currentTripId !== undefined)
      patch.currentTripId = dto.currentTripId;
    if (dto.currentVehicleId !== undefined)
      patch.currentVehicleId = dto.currentVehicleId;
    if (dto.isOnline) patch.lastPresenceTimestamp = new Date();

    const saved = await this.driverAvailabilityRepo.upsertByDriverId(
      dto.driverId,
      patch,
    );
    return toDriverAvailabilityResponseDto(saved);
  }

  // STATUS (online/available/reason)
  async updateStatus(
    driverId: string,
    dto: UpdateDriverStatusDto,
  ): Promise<DriverAvailabilityResponseDto> {
    const saved = await this.driverAvailabilityRepo.updateStatusByDriverId(
      driverId,
      dto,
    );
    const snapshot = toDriverAvailabilityResponseDto(saved);

    this.eventEmitter.emit(DriverAvailabilityEvents.StatusUpdated, {
      at: new Date().toISOString(),
      snapshot,
    } as StatusUpdatedEvent);

    return snapshot;
  }

  async markOnlineFromLogin(driverId: string, atIso: string) {
    await this.driverAvailabilityRepo.ensureForDriver(driverId, {});
    const current = await this.driverAvailabilityRepo.findByDriverId(driverId);
    if (!current)
      throw new NotFoundException(
        `DriverAvailability for ${driverId} not found`,
      );

    const isOnTrip = !!current.currentTripId;

    let eligible = false;

    if (!isOnTrip) {
      const elig = await this.checkOperationalEligibility(
        driverId,
        current.currentVehicleId ?? null, // ← usamos el asignado, no auto-elegimos
      );
      eligible = !!elig.ok; // si no hay vehículo asignado o no es válido ⇒ false
    }

    const patch: Partial<DriverAvailability> = {
      isOnline: true,
      lastOnlineTimestamp: new Date(atIso),
      lastPresenceTimestamp: new Date(),
    };

    if (isOnTrip) {
      patch.isAvailableForTrips = false;
      patch.availabilityReason = AvailabilityReason.ON_TRIP;
    } else if (eligible) {
      patch.isAvailableForTrips = true;
      patch.availabilityReason = null as any; // disponible ⇒ razón NULL
      // NO tocamos currentVehicleId aquí; lo gestiona el admin en otro flujo
    } else {
      patch.isAvailableForTrips = false;
      patch.availabilityReason = AvailabilityReason.UNAVAILABLE;
    }

    const saved = await this.driverAvailabilityRepo.updateStatusByDriverId(
      driverId,
      patch,
    );
    const snapshot = toDriverAvailabilityResponseDto(saved);

    this.eventEmitter.emit(DriverAvailabilityEvents.StatusUpdated, {
      at: new Date().toISOString(),
      snapshot,
    });

    return snapshot;
  }

  // LOCATION ping
  async updateLocation(
    driverId: string,
    dto: UpdateDriverLocationDto,
  ): Promise<DriverAvailabilityResponseDto> {
    const patch = {
      lastLocation: toGeoPoint(dto.lat, dto.lng),
      lastLocationTimestamp: dto.lastLocationTimestamp
        ? new Date(dto.lastLocationTimestamp)
        : undefined,
      lastPresenceTimestamp: new Date(),
    };
    const saved = await this.driverAvailabilityRepo.updateLocationByDriverId(
      driverId,
      patch,
    );
    const snapshot = toDriverAvailabilityResponseDto(saved);

    this.eventEmitter.emit(DriverAvailabilityEvents.LocationUpdated, {
      at: new Date().toISOString(),
      snapshot,
    } as LocationUpdatedEvent);

    return snapshot;
  }

  // SET/UNSET currentTripId
  async setOrClearTrip(
    driverId: string,
    dto: UpdateDriverTripDto,
  ): Promise<DriverAvailabilityResponseDto> {
    const saved = dto.currentTripId
      ? await this.driverAvailabilityRepo.setCurrentTripByDriverId(
          driverId,
          dto.currentTripId,
        )
      : await this.driverAvailabilityRepo.clearCurrentTripByDriverId(driverId);

    const snapshot = toDriverAvailabilityResponseDto(saved);

    this.eventEmitter.emit(DriverAvailabilityEvents.TripUpdated, {
      at: new Date().toISOString(),
      snapshot,
    } as TripUpdatedEvent);

    // opcional: también avisar cambio de estado
    this.eventEmitter.emit(DriverAvailabilityEvents.StatusUpdated, {
      at: new Date().toISOString(),
      snapshot,
    } as StatusUpdatedEvent);

    return snapshot;
  }

  // SOFT DELETE
  async softDelete(driverId: string): Promise<void> {
    await this.driverAvailabilityRepo.softDeleteByDriverId(driverId);
  }

  private emitSafely<T = any>(eventName: string, payload: T) {
    try {
      this.eventEmitter.emit(eventName, payload);
    } catch (e) {
      this.logger.debug(`Event emit failed (${eventName})`, e);
    }
  }
}

// ----------------- helpers de mapeo ----------------
const toISO = (d?: Date | null) =>
  d instanceof Date ? d.toISOString() : (d ?? null);

function toDriverAvailabilityResponseDto(
  da: DriverAvailability,
): DriverAvailabilityResponseDto {
  // lastLocation en DB suele ser GeoJSON { type:'Point', coordinates:[lng, lat] }
  const point = (da as any).lastLocation;
  let lastLocation: { lat: number; lng: number } | null = null;

  if (
    point?.type === 'Point' &&
    Array.isArray(point.coordinates) &&
    point.coordinates.length >= 2
  ) {
    const [lng, lat] = point.coordinates;
    if (typeof lat === 'number' && typeof lng === 'number') {
      lastLocation = { lat, lng };
    }
  } else if (typeof point?.lat === 'number' && typeof point?.lng === 'number') {
    // por si ya viene como {lat,lng}
    lastLocation = { lat: point.lat, lng: point.lng };
  }

  return {
    id: da.id,
    driverId: da.driver?.id ?? (da as any).driverId,

    isOnline: !!da.isOnline,
    isAvailableForTrips: !!da.isAvailableForTrips,

    lastLocation,
    lastLocationTimestamp: toISO(da.lastLocationTimestamp),

    currentTripId: da.currentTrip?.id ?? (da as any).currentTripId ?? null,
    currentVehicleId:
      da.currentVehicle?.id ?? (da as any).currentVehicleId ?? null,

    lastOnlineTimestamp: toISO(da.lastOnlineTimestamp),
    availabilityReason: da.availabilityReason ?? null,

    updatedAt: toISO(da.updatedAt)!,
    deletedAt: toISO((da as any).deletedAt),
  };
}
