import { PaymentMode, TripStatus } from '../entities/trip.entity';

function round2(x: number) {
  return Number(x.toFixed(2));
}
function round3(x: number) {
  return Number(x.toFixed(3));
}
function round4(x: number) {
  return Number(x.toFixed(4));
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
