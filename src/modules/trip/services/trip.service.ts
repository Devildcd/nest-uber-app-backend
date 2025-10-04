import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TripsQueryDto } from '../dtos/trip/trips-query.dto';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { TripResponseDto } from '../dtos/trip/trip-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { TripRepository } from '../repositories/trip.repository';
import { paginated } from 'src/common/utils/response-helpers';
import { PaymentMode, Trip, TripStatus } from '../entities/trip.entity';
import { CreateTripDto } from '../dtos/trip/create-trip.dto';
import { withQueryRunnerTx } from 'src/common/utils/tx.util';
import { DataSource, DeepPartial } from 'typeorm';
import { TripStopsRepository } from '../repositories/trip-stops.repository';
import { TripEventsRepository } from '../repositories/trip-events.repository';
import { EventEmitter2 } from 'eventemitter2';
import { toGeoPoint } from 'src/common/utils/geo.utils';
import { TripEventType } from '../interfaces/trip-event-types.enum';
import { TripStop } from '../entities/trip-stop.entity';
import { IdempotencyKeyRepository } from 'src/modules/core-settings/repositories/idempotency-key.repository';
import { hashCreateTripPayload } from '../utils/dempotency.util';
import { TripHelpersService } from './trip-helpers.service';
import { TripAssignmentRepository } from '../repositories/trip-assignment.repository';
import { StartAssigningDto } from '../dtos/trip-assignment/start-assigning.dto';
import { RejectAssignmentDto } from '../dtos/trip-assignment/reject-assignment.dto';
import { StartArrivingDto } from '../dtos/trip/start-arriving.dto';
import {
  ArrivingStartedEvent,
  AssigningStartedEvent,
  AssignmentExpiredEvent,
  DriverAcceptedEvent,
  DriverArrivedPickupEvent,
  DriverAssignedEvent,
  DriverEnRouteEvent,
  DriverRejectedEvent,
  NoDriversFoundEvent,
  TripCompletedEvent,
  TripDomainEvents,
  TripRequestedEvent,
  TripStartedEvent,
} from 'src/core/domain/events/trip-domain.events';
import { toTripSnapshot } from 'src/core/domain/utils/to-trip-snapshot';
import { TripSnapshotRepository } from '../repositories/trip-snapshot.repository';
import { OrdersService } from 'src/modules/orders/services/orders.service';
import { DriverAvailabilityService } from 'src/modules/drivers-availability/services/driver-availability.service';

@Injectable()
export class TripService {
  constructor(
    private readonly tripRepo: TripRepository,
    private readonly tripAssignmentRepo: TripAssignmentRepository,
    private readonly dataSource: DataSource,
    private readonly tripStopsRepo: TripStopsRepository,
    private readonly tripEventsRepo: TripEventsRepository,
    private readonly events: EventEmitter2,
    private readonly idemRepo: IdempotencyKeyRepository,
    private readonly tripHelpers: TripHelpersService,
    private readonly tripSnapshotRepo: TripSnapshotRepository,
    private readonly orderService: OrdersService,
    private readonly availabilityService: DriverAvailabilityService,
  ) {}
  /**
   * Lista paginada de trips (con relaciones básicas), devolviendo envelope estándar.
   * - Usa el Interceptor: como devolvemos un ApiResponseDto, el interceptor lo respeta.
   * - El ExceptionFilter centraliza los errores (no hace falta try/catch aquí).
   */
  async findAll(
    q: TripsQueryDto,
  ): Promise<ApiResponseDto<TripResponseDto[], PaginationMetaDto>> {
    const { page = 1, limit = 10, ...filters } = q;

    // 1) Repo: entidades + relaciones (passenger/driver/vehicle)
    const [entities, total] = await this.tripRepo.findAllPaginated(
      { page, limit },
      q,
    );

    // 2) Mapeo a DTO de salida
    const items = entities.map(toTripResponseDto);

    // 3) Envelope estandarizado con meta (page/limit/hasNext/hasPrev/nextPage/prevPage)
    return paginated(items, total, page, limit, 'Trips retrieved');
  }

  /** Detalle de un trip por id (con relaciones principales) */
  async getTripById(id: string): Promise<ApiResponseDto<TripResponseDto>> {
    const trip = await this.tripRepo.findById(id, {
      relations: {
        passenger: true,
        driver: true,
        vehicle: true,
        requestedVehicleCategory: true,
        requestedServiceClass: true,
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');

    return {
      success: true,
      message: 'Trip retrieved',
      data: toTripResponseDto(trip),
    };
  }

  /** Viaje activo del PASAJERO (si existe) */
  async getActiveTripForPassenger(
    passengerId: string,
  ): Promise<ApiResponseDto<TripResponseDto | null>> {
    const trip = await this.tripRepo.findActiveByPassenger(passengerId);
    return {
      success: true,
      message: 'Active trip for passenger',
      data: trip ? toTripResponseDto(trip) : null,
    };
  }

  /** Viaje activo del CONDUCTOR (requiere repo helper; ver abajo) */
  async getActiveTripForDriver(
    driverId: string,
  ): Promise<ApiResponseDto<TripResponseDto | null>> {
    const trip = await this.tripRepo.findActiveByDriver(driverId);
    return {
      success: true,
      message: 'Active trip for driver',
      data: trip ? toTripResponseDto(trip) : null,
    };
  }

  /** Auditoría: timeline de eventos del viaje (orden ASC) */
  async getTripEvents(
    tripId: string,
  ): Promise<ApiResponseDto<Array<Record<string, any>>>> {
    const events = await this.tripEventsRepo.listByTrip(tripId);
    return {
      success: true,
      message: 'Trip events retrieved',
      data: events.map((e) => ({
        id: (e as any).id,
        eventType: (e as any).eventType,
        occurredAt: (e as any).occurredAt?.toISOString?.() ?? null,
        metadata: (e as any).metadata ?? null,
      })),
    };
  }

  async requestTrip(
    dto: CreateTripDto,
    idemKey?: string,
  ): Promise<ApiResponseDto<TripResponseDto>> {
    const method = 'POST';
    const endpoint = '/trips';
    const requestHash = idemKey ? hashCreateTripPayload(dto) : null;

    // A) Idempotencia: reclamo/rehúso
    if (idemKey) {
      const claim = await this.idemRepo.claimOrGet({
        key: idemKey,
        method,
        endpoint,
        userId: dto.passengerId,
        tenantId: null,
        requestHash,
        leaseSeconds: 30,
        windowSeconds: 60 * 60,
      });

      if (claim.decision === 'returnStoredSuccess') {
        // ya guardaste un ApiResponseDto<TripResponseDto>
        return claim.responseBody as ApiResponseDto<TripResponseDto>;
      }
      if (claim.decision === 'inProgress') {
        throw new ConflictException(
          `Request in progress. Retry after ${claim.retryAfterSec}s`,
        );
      }
      if (claim.decision === 'returnStoredFailure') {
        throw new BadRequestException(
          claim.errorCode ?? 'IdempotentStoredFailure',
        );
      }
      // si 'proceed' => seguimos con la creación real
    }

    try {
      // B) Trabajo real bajo TX
      const created = await withQueryRunnerTx(
        this.dataSource,
        async (_qr, manager) => {
          // Guardarraíles
          const active = await this.tripRepo.findActiveByPassenger(
            dto.passengerId,
          );
          if (active)
            throw new BadRequestException(
              'Passenger already has an active trip',
            );
          if (!dto.stops?.length)
            throw new BadRequestException(
              'Debe incluir al menos un stop (el destino).',
            );

          const requestedAt = new Date();

          // Trip pending (usa relación passenger)
          const trip = await this.tripRepo.createAndSave(
            {
              passenger: { id: dto.passengerId } as any,
              currentStatus: TripStatus.PENDING,
              paymentMode: dto.paymentMode,
              requestedAt,
              requestedVehicleCategory: { id: dto.vehicleCategoryId } as any,
              requestedServiceClass: { id: dto.serviceClassId } as any,
              pickupPoint: toGeoPoint(
                dto.pickupPoint.lat,
                dto.pickupPoint.lng,
              ) as any,
              pickupAddress: dto.pickupAddress ?? null,
            },
            manager,
          );

          // Stops 1..N (normaliza)
          const prepared: Array<DeepPartial<TripStop>> = dto.stops.map(
            (s, i) => ({
              seq: typeof s.seq === 'number' && s.seq > 0 ? s.seq : i + 1,
              point: toGeoPoint(s.point.lat, s.point.lng) as any,
              address: s.address ?? null,
              placeId: s.placeId ?? null,
              notes: s.notes ?? null,
              plannedArrivalAt: s.plannedArrivalAt
                ? new Date(s.plannedArrivalAt)
                : null,
            }),
          );
          const items = prepared
            .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
            .map((s, i) => ({ ...s, seq: i + 1 }));

          await this.tripStopsRepo.createManyForTrip(trip.id, items, manager);

          // Calcular estimado (pickup → stops)
          const est = await this.tripHelpers.estimateForRequest({
            vehicleCategoryId: dto.vehicleCategoryId,
            serviceClassId: dto.serviceClassId,
            pickup: toGeoPoint(dto.pickupPoint.lat, dto.pickupPoint.lng),
            stops: items.map((it) => it.point as any), // GeoJSON Points
            currency: 'CUP', // o tu default/currency de ciudad
            manager,
          });

          // Persistir snapshot (currency, surge, breakdown, distance/duration/estimated_total)
          await this.tripRepo.applyEstimateSnapshot(
            trip.id,
            {
              currency: est.currency,
              surgeMultiplier: est.surgeMultiplier,
              breakdown: est.breakdown,
              distanceKmEst: est.breakdown.distance_km_est,
              // durationMinEst: est.breakdown.duration_min_est,
              estimatedTotal: est.totalEstimated,
            },
            manager,
          );

          // Event store
          const last = items[items.length - 1] as any;
          await this.tripEventsRepo.append(
            trip.id,
            TripEventType.TRIP_REQUESTED,
            requestedAt,
            {
              payment_mode: dto.paymentMode,
              pickup: {
                lat: dto.pickupPoint.lat,
                lng: dto.pickupPoint.lng,
                address: dto.pickupAddress ?? null,
              },
              stops_count: items.length,
              destination_hint: last
                ? {
                    lat: last.point.coordinates[1],
                    lng: last.point.coordinates[0],
                    address: last.address ?? null,
                  }
                : null,
            },
            manager,
          );
          return trip;
        },
        { logLabel: 'trip.request' },
      );

      // C) Leer completo y mapear al DTO de salida
      const full = await this.tripRepo.findById(created.id, {
        relations: {
          passenger: true,
          driver: true,
          vehicle: true,
          requestedVehicleCategory: true,
          requestedServiceClass: true,
        },
      });
      // (Opcional) si necesitas validar que hay stops creados:
      // const stops = await this.tripStopsRepo.findByTripOrdered(created.id);

      const data: TripResponseDto = toTripResponseDto(full!);

      this.events.emit(TripDomainEvents.TripRequested, {
        at: new Date().toISOString(),
        snapshot: toTripSnapshot(full!),
      } as TripRequestedEvent);

      const response: ApiResponseDto<TripResponseDto> = {
        success: true,
        message: 'Trip requested',
        data,
      };

      // D) Persistir éxito canónico si había key
      if (idemKey) {
        await this.idemRepo.succeed(idemKey, 200, response, {
          'content-type': 'application/json',
        });
      }

      return response;
    } catch (err) {
      // E) Persistir fallo si había key
      if (idemKey) {
        const code =
          err instanceof BadRequestException
            ? 'BAD_REQUEST'
            : err instanceof ConflictException
              ? 'CONFLICT'
              : 'ERROR';
        await this.idemRepo.fail(idemKey, code, {
          message: err?.message,
        });
      }
      throw err;
    }
  }

  /**
   * Fase 2 (inicio): pasa el trip de PENDING -> ASSIGNING con TX corta.
   * - Lock FOR UPDATE
   * - Validar status
   * - Persistir nuevo status
   * - trip_events.append(assigning_started)
   * - Emitir domain-event
   * - Devolver TripResponseDto (para front o logs)
   */
  async startAssigning(
    tripId: string,
    _dto: StartAssigningDto,
  ): Promise<ApiResponseDto<TripResponseDto>> {
    const now = new Date();

    const updated = await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        // 1) Lock
        const t = await this.tripRepo.lockByIdForUpdate(tripId, manager);
        if (!t) throw new NotFoundException('Trip not found');

        // 2) Precondición
        if (t.currentStatus !== TripStatus.PENDING) {
          throw new ConflictException(
            `Trip must be 'pending' to start assigning`,
          );
        }

        // 3) PENDING -> ASSIGNING (TX corta)
        await this.tripRepo.moveToAssigningWithLock(tripId, now, manager);

        // 4) Evento
        await this.tripEventsRepo.append(
          tripId,
          TripEventType.ASSIGNING_STARTED,
          now,
          {
            previous_status: TripStatus.PENDING,
            requested_vehicle_category_id:
              (t as any).requestedVehicleCategory?.id ??
              (t as any).requestedVehicleCategoryId ??
              null,
            requested_service_class_id:
              (t as any).requestedServiceClass?.id ??
              (t as any).requestedServiceClassId ??
              null,
          },
          manager,
        );

        // 5) Releer para responder
        const full = await this.tripRepo.findById(tripId, {
          relations: {
            passenger: true,
            driver: true,
            vehicle: true,
            requestedVehicleCategory: true,
            requestedServiceClass: true,
          },
        });

        this.events.emit(TripDomainEvents.AssigningStarted, {
          at: now.toISOString(),
          snapshot: toTripSnapshot(full!),
        } as AssigningStartedEvent);

        return full!;
      },
      { logLabel: 'trip.assign.start' },
    );

    return {
      success: true,
      message: 'Trip moved to assigning',
      data: toTripResponseDto(updated),
    };
  }

  async acceptAssignment(
    assignmentId: string,
  ): Promise<ApiResponseDto<TripResponseDto>> {
    const now = new Date();

    const tripId = await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        // 1) Aceptar con locks
        const accepted = await this.tripAssignmentRepo.acceptOfferWithLocks(
          assignmentId,
          now,
          manager,
        );
        if (!accepted) throw new NotFoundException('Assignment not found');

        const { tripId, driverId, vehicleId } = accepted;

        // 2) Fijar en TRIP
        await this.tripRepo.assignDriver(
          tripId,
          { driverId, vehicleId, acceptedAt: now },
          manager,
        );

        // 3) Cancelar otras ofertas activas
        await this.tripAssignmentRepo.cancelOtherOffers(
          tripId,
          assignmentId,
          manager,
        );

        // 4) Eventos
        await this.tripEventsRepo.append(
          tripId,
          TripEventType.DRIVER_ACCEPTED,
          now,
          {
            assignment_id: assignmentId,
            driver_id: driverId,
            vehicle_id: vehicleId,
          },
          manager,
        );
        await this.tripEventsRepo.append(
          tripId,
          TripEventType.DRIVER_ASSIGNED,
          now,
          { driver_id: driverId, vehicle_id: vehicleId },
          manager,
        );

        this.events.emit(TripDomainEvents.DriverAccepted, {
          at: now.toISOString(),
          tripId,
          assignmentId,
          driverId,
          vehicleId,
        } as DriverAcceptedEvent);

        this.events.emit(TripDomainEvents.DriverAssigned, {
          at: now.toISOString(),
          tripId,
          driverId,
          vehicleId,
        } as DriverAssignedEvent);

        return tripId;
      },
      { logLabel: 'trip.assignment.accept' },
    );

    // Devolver el trip actualizado
    const full = await this.tripRepo.findById(tripId, {
      relations: {
        passenger: true,
        driver: true,
        vehicle: true,
        requestedVehicleCategory: true,
        requestedServiceClass: true,
      },
    });

    return {
      success: true,
      message: 'Assignment accepted and trip updated',
      data: toTripResponseDto(full!),
    };
  }

  async rejectAssignment(
    assignmentId: string,
    dto: RejectAssignmentDto,
  ): Promise<
    ApiResponseDto<{
      assignmentId: string;
      nextAssignmentId?: string;
      message: string;
    }>
  > {
    const now = new Date();

    // 1) TX corta: marcar la oferta como REJECTED y registrar evento
    const tripId = await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        // 1.1) Verificamos que la oferta siga activa para poder rechazarla
        const a = await this.tripAssignmentRepo.getOfferedById(
          assignmentId,
          manager,
        );
        if (!a) {
          // Puede haber expirado / ya respondida
          throw new ConflictException('Assignment is not active or not found');
        }

        // 1.2) Marcar REJECTED
        await this.tripAssignmentRepo.rejectOffer(assignmentId, now, manager);

        // 1.3) Evento
        await this.tripEventsRepo.append(
          a.trip.id,
          TripEventType.DRIVER_REJECTED,
          now,
          {
            assignment_id: assignmentId,
            driver_id: a.driver.id,
            vehicle_id: a.vehicle.id,
            reason: dto?.reason ?? null,
          },
          manager,
        );

        this.events.emit(TripDomainEvents.DriverRejected, {
          at: now.toISOString(),
          tripId: a.trip.id,
          assignmentId,
          driverId: a.driver.id,
          vehicleId: a.vehicle.id,
          reason: dto?.reason ?? null,
        } as DriverRejectedEvent);

        return a.trip.id;
      },
      { logLabel: 'trip.assignment.reject' },
    );

    // 2) Intentar inmediatamente una nueva oferta (una sola iteración del matching)
    //    Nota: StartAssigningDto puede traer defaults; usamos valores por defecto razonables.
    const next = await this.tripHelpers.runMatchingOnce(tripId, {
      searchRadiusMeters: 3000,
      maxCandidates: 5,
      offerTtlSeconds: 20,
    });

    return {
      success: true,
      message: 'Assignment rejected; matching continued',
      data: {
        assignmentId,
        nextAssignmentId: next.assignmentId, // puede venir undefined si no hubo candidatos
        message: next.message,
      },
    };
  }

  async expireAssignment(assignmentId: string): Promise<
    ApiResponseDto<{
      assignmentId: string;
      nextAssignmentId?: string;
      message: string;
    }>
  > {
    const now = new Date();

    // A) TX corta: marcar expired + evento
    const tripId = await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        const a = await this.tripAssignmentRepo.getOfferedById(
          assignmentId,
          manager,
        );
        if (!a)
          throw new ConflictException('Assignment not active or not found');

        await this.tripAssignmentRepo.expireOffer(assignmentId, now, manager);

        await this.tripEventsRepo.append(
          a.trip.id,
          TripEventType.ASSIGNMENT_EXPIRED,
          now,
          {
            assignment_id: assignmentId,
            driver_id: a.driver.id,
            vehicle_id: a.vehicle.id,
          },
          manager,
        );

        this.events.emit(TripDomainEvents.AssignmentExpired, {
          at: now.toISOString(),
          tripId: a.trip.id,
          assignmentId,
          driverId: a.driver.id,
          vehicleId: a.vehicle.id,
        } as AssignmentExpiredEvent);

        return a.trip.id;
      },
      { logLabel: 'trip.assignment.expire' },
    );

    // B) Reintentar matching (una sola oferta nueva como en tu cascarón)
    const next = await this.tripHelpers.runMatchingOnce(tripId, {
      searchRadiusMeters: 3000,
      maxCandidates: 5,
      offerTtlSeconds: 20,
    });

    // C) Si no hay nuevos candidatos → cerrar como NO_DRIVERS_FOUND
    if (!next.assignmentId) {
      await withQueryRunnerTx(
        this.dataSource,
        async (_qr, manager) => {
          // Lock y transición segura
          const t = await this.tripRepo.lockByIdForUpdate(tripId, manager);
          if (!t) throw new NotFoundException('Trip not found');

          if (
            [TripStatus.ASSIGNING, TripStatus.PENDING].includes(t.currentStatus)
          ) {
            await this.tripRepo.moveToNoDriversFoundWithLock(
              tripId,
              now,
              manager,
            );

            await this.tripEventsRepo.append(
              tripId,
              TripEventType.NO_DRIVERS_FOUND,
              now,
              { reason: 'after_expire_no_candidates' },
              manager,
            );

            this.events.emit(TripDomainEvents.NoDriversFound, {
              at: now.toISOString(),
              tripId,
              reason: 'after_expire_no_candidates',
            } as NoDriversFoundEvent);

            // Limpieza: cancela cualquier offered remanente
            await this.tripAssignmentRepo.cancelAllActiveOffers(
              tripId,
              manager,
            );
          }
        },
        { logLabel: 'trip.no_drivers_found' },
      );

      return {
        success: true,
        message: 'Assignment expired; no drivers found',
        data: {
          assignmentId,
          nextAssignmentId: undefined,
          message: 'Trip marked as no_drivers_found',
        },
      };
    }

    // D) Hubo nueva oferta
    return {
      success: true,
      message: 'Assignment expired; new offer created',
      data: {
        assignmentId,
        nextAssignmentId: next.assignmentId,
        message: next.message,
      },
    };
  }

  async markTripNoDriversFound(
    tripId: string,
    reason: string = 'matching_exhausted',
  ): Promise<ApiResponseDto<TripResponseDto>> {
    const now = new Date();

    await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        const t = await this.tripRepo.lockByIdForUpdate(tripId, manager);
        if (!t) throw new NotFoundException('Trip not found');

        if (
          [TripStatus.ASSIGNING, TripStatus.PENDING].includes(t.currentStatus)
        ) {
          await this.tripRepo.moveToNoDriversFoundWithLock(
            tripId,
            now,
            manager,
          );

          await this.tripEventsRepo.append(
            tripId,
            TripEventType.NO_DRIVERS_FOUND,
            now,
            { reason },
            manager,
          );

          // Cancelar todas las offered activas (si quedara alguna)
          await this.tripAssignmentRepo.cancelAllActiveOffers(tripId, manager);
        } else {
          throw new ConflictException(
            `Trip is not in assigning/pending (current=${t.currentStatus})`,
          );
        }
      },
      { logLabel: 'trip.no_drivers_found.manual' },
    );

    const full = await this.tripRepo.findById(tripId, {
      relations: {
        passenger: true,
        driver: true,
        vehicle: true,
        requestedVehicleCategory: true,
        requestedServiceClass: true,
      },
    });

    return {
      success: true,
      message: 'Trip marked as no_drivers_found',
      data: toTripResponseDto(full!),
    };
  }

  async startArriving(
    tripId: string,
    dto: StartArrivingDto,
  ): Promise<ApiResponseDto<TripResponseDto>> {
    const now = new Date();

    await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        // 1) Lock y validaciones de estado/driver
        const t = await this.tripRepo.lockByIdForUpdate(tripId, manager);
        if (!t) throw new NotFoundException('Trip not found');

        if (t.currentStatus !== TripStatus.ACCEPTED) {
          throw new ConflictException(
            `Trip must be 'accepted' to move to 'arriving'`,
          );
        }

        const driverId = t.driver?.id ?? (t as any).driverId;
        if (!driverId)
          throw new BadRequestException('Trip has no driver fixed yet');
        if (driverId !== dto.driverId) {
          throw new ConflictException(
            'Caller driver does not match trip.driver_id',
          );
        }

        // 2) Estado → ARRIVING (usa tu repo: arrivedPickupAt + status)
        await this.tripRepo.setArriving(tripId, now, manager);

        // 3) Evento “driver en camino” (o LOCATION_UPDATE si no agregas el enum)
        await this.tripEventsRepo.append(
          tripId,
          TripEventType.DRIVER_EN_ROUTE, // o TripEventType.LOCATION_UPDATE
          now,
          {
            driver_id: driverId,
            eta_min: dto.etaMinutes ?? null,
            driver_position:
              dto.driverLat != null && dto.driverLng != null
                ? { lat: dto.driverLat, lng: dto.driverLng }
                : null,
          },
          manager,
        );

        // TODO WS: notificar a pasajero con ETA y al driver (eco)
      },
      { logLabel: 'trip.arriving.start' },
    );

    // Respuesta: trip actualizado
    const full = await this.tripRepo.findById(tripId, {
      relations: {
        passenger: true,
        driver: true,
        vehicle: true,
        requestedVehicleCategory: true,
        requestedServiceClass: true,
      },
    });

    this.events.emit(TripDomainEvents.ArrivingStarted, {
      at: now.toISOString(),
      snapshot: toTripSnapshot(full!),
    } as ArrivingStartedEvent);

    this.events.emit(TripDomainEvents.DriverEnRoute, {
      at: now.toISOString(),
      tripId,
      driverId: full!.driver!.id,
      etaMinutes: dto.etaMinutes ?? null,
      driverPosition:
        dto.driverLat != null && dto.driverLng != null
          ? { lat: dto.driverLat, lng: dto.driverLng }
          : null,
    } as DriverEnRouteEvent);

    return {
      success: true,
      message: 'Driver en camino (arriving)',
      data: toTripResponseDto(full!),
    };
  }

  /**
   * Fase 4.1 — “He llegado”: ACCEPTED/ARRIVING -> ARRIVING (marca arrived_pickup_at)
   */
  async markArrivedPickup(
    tripId: string,
    driverId: string,
  ): Promise<ApiResponseDto<TripResponseDto>> {
    const now = new Date();

    await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        // 1) Lock trip
        const t = await this.tripRepo.findByIdForUpdate(tripId, manager);
        if (!t) throw new NotFoundException('Trip not found');

        // 2) Validaciones: estado y driver asignado
        if (
          ![TripStatus.ACCEPTED, TripStatus.ARRIVING].includes(t.currentStatus)
        ) {
          throw new ConflictException(
            'Trip must be accepted/arriving to mark arrival',
          );
        }
        const assignedDriverId = t.driver?.id ?? (t as any).driverId;
        if (!assignedDriverId || assignedDriverId !== driverId) {
          throw new BadRequestException('Driver not assigned to this trip');
        }

        // 3) Transición -> ARRIVING + arrived_pickup_at
        await this.tripRepo.setArriving(tripId, now, manager);

        // 4) Evento
        await this.tripEventsRepo.append(
          tripId,
          TripEventType.DRIVER_ARRIVED_PICKUP,
          now,
          { driver_id: driverId },
          manager,
        );

        // TODO: WS a pasajero/driver con ETA actualizado si lo tienes
      },
      { logLabel: 'trip.arrived_pickup' },
    );

    // 5) Respuesta (trip fresco)
    const full = await this.tripRepo.findById(tripId, {
      relations: {
        passenger: true,
        driver: true,
        vehicle: true,
        requestedVehicleCategory: true,
        requestedServiceClass: true,
      },
    });

    this.events.emit(TripDomainEvents.DriverArrivedPickup, {
      at: now.toISOString(),
      tripId,
      driverId,
    } as DriverArrivedPickupEvent);

    return {
      success: true,
      message: 'Driver arrival registered',
      data: toTripResponseDto(full!),
    };
  }

  /**
   * Fase 4.2 — Inicio del viaje: ACCEPTED/ARRIVING -> IN_PROGRESS
   */
  async startTripInProgress(
    tripId: string,
    driverId: string,
  ): Promise<ApiResponseDto<TripResponseDto>> {
    const now = new Date();

    await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        // 1) Lock trip
        const t = await this.tripRepo.findByIdForUpdate(tripId, manager);
        if (!t) throw new NotFoundException('Trip not found');

        // 2) Validaciones
        if (
          ![TripStatus.ACCEPTED, TripStatus.ARRIVING].includes(t.currentStatus)
        ) {
          throw new ConflictException(
            'Trip must be accepted/arriving to start in-progress',
          );
        }
        const assignedDriverId = t.driver?.id ?? (t as any).driverId;
        if (!assignedDriverId || assignedDriverId !== driverId) {
          throw new BadRequestException('Driver not assigned to this trip');
        }

        // 3) Transición -> IN_PROGRESS + started_at
        await this.tripRepo.startTrip(tripId, now, manager);

        // 4) Evento
        await this.tripEventsRepo.append(
          tripId,
          TripEventType.TRIP_STARTED,
          now,
          { driver_id: driverId },
          manager,
        );

        // TODO: asegurar availability:
        // await this.driverAvailabilityRepo.markOnTrip(driverId, tripId, manager);
        // TODO: WS eco a driver + pasajero
      },
      { logLabel: 'trip.start' },
    );

    // 5) Respuesta con trip fresco
    const full = await this.tripRepo.findById(tripId, {
      relations: {
        passenger: true,
        driver: true,
        vehicle: true,
        requestedVehicleCategory: true,
        requestedServiceClass: true,
      },
    });

    this.events.emit(TripDomainEvents.TripStarted, {
      at: now.toISOString(),
      tripId,
      driverId,
    } as TripStartedEvent);

    return {
      success: true,
      message: 'Trip started',
      data: toTripResponseDto(full!),
    };
  }

  async completeTrip(
    tripId: string,
    dto: {
      driverId: string;
      actualDistanceKm?: number | null;
      actualDurationMin?: number | null;
      extraFees?: number | null;
    },
  ): Promise<ApiResponseDto<TripResponseDto>> {
    const now = new Date();
    let paymentMode!: PaymentMode;
    let driverIdFixed!: string;

    await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        // 1) Lock + validaciones
        const t = await this.tripRepo.findByIdForUpdate(tripId, manager);
        if (!t) throw new NotFoundException('Trip not found');
        if (t.currentStatus !== TripStatus.IN_PROGRESS) {
          throw new ConflictException(`Trip must be 'in_progress' to complete`);
        }
        const assignedDriverId = t.driver?.id ?? (t as any).driverId;
        if (!assignedDriverId || assignedDriverId !== dto.driverId) {
          throw new BadRequestException('Driver not assigned / mismatched');
        }

        // 2) Dist/tiempo: usar lo que venga, o fallback con Haversine (pickup+stops)
        let dKm = dto.actualDistanceKm;
        let dMin = dto.actualDurationMin;
        if (dKm == null || dMin == null) {
          const stops = await this.tripStopsRepo.findByTripOrdered(
            tripId,
            manager,
          );
          const points = [
            t.pickupPoint as any,
            ...stops.map((s) => s.point as any),
          ];
          const distKm = this.tripHelpers['chainHaversineKm'](points as any);
          dKm = dKm ?? distKm;
          dMin = dMin ?? (distKm / 30) * 60;
        }

        // 3) Pricing final (servicio auxiliar)
        const final = await this.tripHelpers.computeFinalForCompletion(
          t,
          Number(dKm),
          Number(dMin),
          dto.extraFees ?? null,
          manager,
        );

        // 4) Persistir cierre en trips
        await this.tripRepo.completeTrip(
          tripId,
          {
            distanceKm: final.distanceKm,
            durationMin: final.durationMin,
            fareTotal: final.fareTotal,
            surgeMultiplier: final.surgeMultiplier,
            breakdown: final.breakdown,
            completedAt: now,
          },
          manager,
        );

        // 5) Snapshot inmutable (best-effort)
        try {
          if (this.tripSnapshotRepo && t.driver && t.vehicle) {
            await this.tripSnapshotRepo.upsertForTrip(
              {
                tripId: t.id,
                driverName: (t.driver as any)?.name ?? 'Driver',
                driverPhone: (t.driver as any)?.phoneNumber ?? null,
                vehicleMake: (t.vehicle as any)?.make ?? '',
                vehicleModel: (t.vehicle as any)?.model ?? '',
                vehicleColor: (t.vehicle as any)?.color ?? null,
                vehiclePlate: (t.vehicle as any)?.plateNumber ?? '',
                serviceClassName:
                  t.requestedServiceClass?.name ??
                  (t as any).requestedServiceClass?.name ??
                  'Standard',
              },
              manager,
            );
          }
        } catch {}

        // 6) Liberar trip y re-evaluar disponibilidad (servicio availability)
        await this.availabilityService.onTripEnded(
          assignedDriverId,
          t.vehicle?.id ?? null,
          manager,
        );

        // 7) Event store
        await this.tripEventsRepo.append(
          tripId,
          TripEventType.TRIP_COMPLETED,
          now,
          {
            driver_id: assignedDriverId,
            fare_total: final.fareTotal,
            currency: final.currency,
          },
          manager,
        );

        driverIdFixed = assignedDriverId;
        paymentMode = t.paymentMode;

        if (paymentMode === PaymentMode.CASH) {
          await this.orderService.createCashOrderOnTripClosureTx(
            manager,
            tripId,
            { currencyDefault: 'CUP' }, // opcional
          );
        }
      },
      { logLabel: 'trip.complete' },
    );

    // 8) Domain event (sin WS)
    this.events.emit(TripDomainEvents.TripCompleted, {
      at: now.toISOString(),
      tripId,
      driverId: driverIdFixed,
    } as TripCompletedEvent);

    // 9) Pago CASH luego del commit
    // if (paymentMode === PaymentMode.CASH) {
    //   const fresh = await this.tripRepo.findById(tripId);
    //   await this.orderService.createCashOrderOnTripClosureTx(tripId, {
    //     total: fresh?.fareTotal ?? 0,
    //     currency: fresh?.fareFinalCurrency ?? 'USD',
    //     breakdown: fresh?.fareBreakdown ?? null,
    //   });
    // }

    // 10) Respuesta
    const full = await this.tripRepo.findById(tripId, {
      relations: {
        passenger: true,
        driver: true,
        vehicle: true,
        requestedVehicleCategory: true,
        requestedServiceClass: true,
        estimateVehicleType: true,
      },
    });

    return {
      success: true,
      message: 'Trip completed',
      data: toTripResponseDto(full!),
    };
  }
}

const toISO = (d?: Date | null) =>
  d instanceof Date ? d.toISOString() : (d ?? null);

function toTripResponseDto(t: Trip): TripResponseDto {
  // pickupPoint en DB es GeoJSON: { type: 'Point', coordinates: [lng, lat] }
  const lat = Array.isArray((t as any).pickupPoint?.coordinates)
    ? (t as any).pickupPoint.coordinates[1]
    : undefined;
  const lng = Array.isArray((t as any).pickupPoint?.coordinates)
    ? (t as any).pickupPoint.coordinates[0]
    : undefined;

  return {
    id: t.id,

    passengerId: t.passenger?.id ?? (t as any).passengerId,
    driverId: t.driver?.id ?? (t as any).driverId ?? null,
    vehicleId: t.vehicle?.id ?? (t as any).vehicleId ?? null,
    orderId: (t as any).order?.id ?? (t as any).orderId ?? null,

    currentStatus: t.currentStatus,
    paymentMode: t.paymentMode,
    requestedVehicleCategoryId:
      (t as any).requestedVehicleCategory?.id ??
      (t as any).requestedVehicleCategoryId,
    requestedVehicleCategoryName:
      (t as any).requestedVehicleCategory?.name ?? null,

    requestedServiceClassId:
      (t as any).requestedServiceClass?.id ??
      (t as any).requestedServiceClassId,
    requestedServiceClassName: (t as any).requestedServiceClass?.name ?? null,

    requestedAt: toISO(t.requestedAt)!,
    acceptedAt: toISO(t.acceptedAt),
    pickupEtaAt: toISO(t.pickupEtaAt),
    arrivedPickupAt: toISO(t.arrivedPickupAt),
    startedAt: toISO(t.startedAt),
    completedAt: toISO(t.completedAt),
    canceledAt: toISO(t.canceledAt),

    pickupPoint:
      lat !== undefined && lng !== undefined
        ? { lat, lng }
        : { lat: 0, lng: 0 }, // si prefieres, usa `null` y marca opcional en el DTO
    pickupAddress: t.pickupAddress ?? null,

    fareEstimatedTotal: (t as any).fareEstimatedTotal ?? null,
    fareFinalCurrency: t.fareFinalCurrency ?? null,
    fareDistanceKm: t.fareDistanceKm ?? null,
    fareDurationMin: t.fareDurationMin ?? null,
    fareSurgeMultiplier: t.fareSurgeMultiplier,
    fareTotal: t.fareTotal ?? null,
    fareBreakdown: (t as any).fareBreakdown ?? null,

    createdAt: toISO(t.createdAt)!,
    updatedAt: toISO(t.updatedAt)!,
  };
}
