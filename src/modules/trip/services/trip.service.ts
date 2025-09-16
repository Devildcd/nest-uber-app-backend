import { Injectable } from '@nestjs/common';
import { TripsQueryDto } from '../dto/trips-query.dto';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { TripResponseDto } from '../dto/trip-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { TripRepository } from '../repositories/trip.repository';
import { paginated } from 'src/common/utils/response-helpers';
import { Trip } from '../entities/trip.entity';

@Injectable()
export class TripService {
  constructor(private readonly tripRepo: TripRepository) {}
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
