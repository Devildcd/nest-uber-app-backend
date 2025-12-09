import { PaymentMode, TripStatus } from '../entities/trip.entity';

export interface FareBreakdown {
  // ===== base del cálculo (valores *ya* multiplicados por service class) =====
  base_fare: number;
  cost_per_km: number;
  cost_per_minute: number;
  min_fare: number;

  // ===== multiplicadores de la service class =====
  applied_multipliers: {
    base: number;
    per_km: number;
    per_min: number;
    min_fare: number;
  };

  // ===== métricas del estimate =====
  distance_km_est: number;
  duration_min_est: number;

  // ===== totales =====
  subtotal: number;
  total: number;
  surge_multiplier: number;

  // ===== metadata =====
  vehicle_type_id?: string;
  service_class_id?: string;
  category_id?: string;

  vehicle_type_name: string;
  service_class_name: string;
  category_name: string;

  // ===== opcional: extras / descuentos / espera =====
  booking_fee?: number;
  discounts?: number;
  waiting_time_minutes?: number;

  // 👇 NUEVO: recargos detallados
  extra_fees_total?: number;
  waiting_reason?: string;
  extra_lines?: Array<{
    code: string; // 'wait_penalty'
    label: string; // 'Recargo por espera'
    amount: number; // monto del recargo
    meta?: Record<string, any>; // { waiting_minutes: 5, note: '...' }
  }>;
}

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
