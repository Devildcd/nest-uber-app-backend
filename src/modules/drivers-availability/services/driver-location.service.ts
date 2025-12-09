import { Injectable, NotFoundException } from '@nestjs/common';
import { DriverAvailabilityRepository } from '../repositories/driver-availability.repository';

export type LngLat = { lng: number; lat: number };

export type DriverEtaResult = {
  etaMinutes: number | null;
  driverPosition: LngLat | null;
  sourceTimestampIso: string | null;
};

@Injectable()
export class DriverLocationService {
  /** km/h promedio urbana; muévelo a config si quieres */
  private readonly avgKmh = 28;

  constructor(private readonly daRepo: DriverAvailabilityRepository) {}

  /** Lee last_location del driver y estima ETA hasta 'to'. */
  async estimateTo(driverId: string, to: LngLat): Promise<DriverEtaResult> {
    const row = await this.daRepo.findByDriverId(driverId);
    if (!row)
      throw new NotFoundException(
        `DriverAvailability for ${driverId} not found`,
      );

    const geo: unknown = (row as any).lastLocation;
    const ts: Date | null = (row as any).lastLocationTimestamp ?? null;
    const driverPosition = extractLngLat(geo);

    if (!driverPosition) {
      return {
        etaMinutes: null,
        driverPosition: null,
        sourceTimestampIso: ts ? ts.toISOString() : null,
      };
    }

    const distKm = haversineKm(driverPosition, to);
    const minutes = Math.round((distKm / this.avgKmh) * 60);
    const eta = clamp(minutes, 1, 90);

    return {
      etaMinutes: eta,
      driverPosition,
      sourceTimestampIso: ts ? ts.toISOString() : null,
    };
  }
}

// ---------- helpers puros ----------
function extractLngLat(geo: unknown): LngLat | null {
  const g = geo as {
    type?: string;
    coordinates?: [number, number];
    lat?: number;
    lng?: number;
  } | null;
  if (
    g?.type === 'Point' &&
    Array.isArray(g.coordinates) &&
    g.coordinates.length >= 2
  ) {
    const [lng, lat] = g.coordinates;
    if (typeof lng === 'number' && typeof lat === 'number') return { lng, lat };
  }
  if (typeof g?.lng === 'number' && typeof g?.lat === 'number')
    return { lng: g.lng, lat: g.lat };
  return null;
}

function haversineKm(a: LngLat, b: LngLat): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}
