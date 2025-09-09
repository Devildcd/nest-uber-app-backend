import { PaymentMode, TripStatus } from '../entities/trip.entity';

export interface FareBreakdown {
  base_fare?: number;
  distance_fare?: number;
  time_fare?: number;
  surge_multiplier?: number;
  discounts?: number;
  waiting_time_minutes?: number;
  // agrega campos internos si necesitas
}

/** Proyección ligera para listados (mejor performance que cargar relaciones) */

export interface TripListItemProjection {
  id: string;
  passengerId: string;
  driverId: string | null;
  vehicleId: string | null;
  currentStatus: TripStatus;
  paymentMode: PaymentMode;
  requestedAt: Date;
  pickupAddress: string | null;
  fareFinalCurrency: string | null;
  fareTotal: number | null;
}

export interface NearbyParams {
  lat: number; // -90..90
  lng: number; // -180..180
  radiusMeters: number; // radio en METROS
  statusIn?: TripStatus[];
  page?: number;
  limit?: number;
}
