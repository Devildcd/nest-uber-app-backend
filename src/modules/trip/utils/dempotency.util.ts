import crypto from 'crypto';
import { CreateTripDto } from '../dtos/trip/create-trip.dto';

export function hashCreateTripPayload(dto: CreateTripDto): string {
  const stops = (dto.stops ?? [])
    .map((s) => ({
      lat: s.point.lat,
      lng: s.point.lng,
      address: s.address ?? null,
      placeId: s.placeId ?? null,
      seq: s.seq ?? null,
      plannedArrivalAt: s.plannedArrivalAt ?? null,
    }))
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

  const canonical = {
    passengerId: dto.passengerId,
    paymentMode: dto.paymentMode,
    pickup: {
      lat: dto.pickupPoint.lat,
      lng: dto.pickupPoint.lng,
      address: dto.pickupAddress ?? null,
    },
    stops,
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
}
