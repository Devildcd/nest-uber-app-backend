import { Trip } from 'src/modules/trip/entities/trip.entity';
import { TripSnapshot } from '../events/trip-domain.events';

export function toTripSnapshot(t: Trip): TripSnapshot {
  // pickupPoint puede venir como GeoJSON {type:'Point', coordinates:[lng,lat]} o string.
  let pickup: TripSnapshot['pickup'] = null;
  const p: any = (t as any).pickupPoint;
  if (
    p?.type === 'Point' &&
    Array.isArray(p.coordinates) &&
    p.coordinates.length >= 2
  ) {
    const [lng, lat] = p.coordinates;
    if (typeof lat === 'number' && typeof lng === 'number') {
      pickup = { lat, lng, address: t.pickupAddress ?? null };
    }
  }

  return {
    tripId: t.id,
    passengerId: t.passenger?.id ?? (t as any).passengerId,
    driverId: t.driver?.id ?? (t as any).driverId ?? null,
    vehicleId: t.vehicle?.id ?? (t as any).vehicleId ?? null,
    currentStatus: t.currentStatus as TripSnapshot['currentStatus'],
    pickup,
    fareEstimatedTotal: (t as any).fareEstimatedTotal ?? null,
    fareFinalCurrency: t.fareFinalCurrency ?? null,
    requestedAt: t.requestedAt ? t.requestedAt.toISOString() : null,
    updatedAt: t.updatedAt ? t.updatedAt.toISOString() : null,
  };
}
