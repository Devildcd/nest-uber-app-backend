import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { TripsQueryDto } from '../dtos/trip/trips-query.dto';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { TripResponseDto } from '../dtos/trip/trip-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { TripRepository } from '../repositories/trip.repository';
import { ok, paginated } from 'src/common/utils/response-helpers';
import { Trip, TripStatus } from '../entities/trip.entity';
import { CreateTripDto } from '../dtos/trip/create-trip.dto';
import { withQueryRunnerTx } from 'src/common/utils/tx.util';
import { DataSource, DeepPartial, EntityManager, Point } from 'typeorm';
import { TripStopsRepository } from '../repositories/trip-stops.repository';
import { TripEventsRepository } from '../repositories/trip-events.repository';
import { EventEmitter2 } from 'eventemitter2';
import { toGeoPoint } from 'src/common/utils/geo.utils';
import { TripEventType } from '../interfaces/trip-event-types.enum';
import { TripRequestedEvent } from '../domain/events/trip-requested.event';
import { TripStop } from '../entities/trip-stop.entity';
import { IdempotencyKeyRepository } from 'src/modules/core-settings/repositories/idempotency-key.repository';
import { hashCreateTripPayload } from '../utils/dempotency.util';
import { TripHelpersService } from './trip-helpers.service';

@Injectable()
export class TripService {
  constructor(
    private readonly tripRepo: TripRepository,
    private readonly dataSource: DataSource,
    private readonly tripStopsRepo: TripStopsRepository,
    private readonly tripEventsRepo: TripEventsRepository,
    private readonly events: EventEmitter2,
    private readonly idemRepo: IdempotencyKeyRepository,
    private readonly tripHelpers: TripHelpersService,
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
            currency: 'USD', // o tu default/currency de ciudad
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
              durationMinEst: est.breakdown.duration_min_est,
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

          // Domain event
          await this.events.emitAsync(
            'trip.requested',
            new TripRequestedEvent(trip.id, dto.passengerId, requestedAt),
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
