import { PaymentMode, TripStatus } from '../entities/trip.entity';

export interface FareBreakdown {
  // ===== base del cálculo (valores *ya* multiplicados por service class) =====
  base_fare: number; // base final usada en el subtotal
  cost_per_km: number; // tarifa por km final usada
  cost_per_minute: number; // tarifa por minuto final usada
  min_fare: number; // mínimo final aplicado

  // ===== multiplicadores de la service class (para auditoría) =====
  applied_multipliers: {
    base: number; // base_fare_multiplier
    per_km: number; // cost_per_km_multiplier
    per_min: number; // cost_per_minute_multiplier
    min_fare: number; // min_fare_multiplier
  };

  // ===== métricas del estimate =====
  distance_km_est: number; // ej. haversine encadenado
  duration_min_est: number; // ej. dist/vel * 60

  // ===== totales de estimate (pre cierre) =====
  subtotal: number; // base + perKm*dist + perMin*dur
  total: number; // max(subtotal, min_fare)
  surge_multiplier: number; // por ahora 1.0 si no aplica

  // ===== opcional: metadatos del snapshot =====
  vehicle_type_id?: string;
  service_class_id?: string;
  category_id?: string;

  vehicle_type_name: string;
  service_class_name: string;
  category_name: string;

  // ===== opcional: para UI / pricing futuro =====
  booking_fee?: number; // si luego lo agregas
  discounts?: number;
  waiting_time_minutes?: number;
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
