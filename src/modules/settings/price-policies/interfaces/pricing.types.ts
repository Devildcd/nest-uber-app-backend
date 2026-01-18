import { PricePolicyScopeType } from '../entities/price-policy.entity';

export type Money = number;

export interface AppliedMultipliers {
  base: number;
  per_km: number;
  per_min: number;
  min_fare: number;
}

export interface RateCard {
  policyId: string;
  scopeType: PricePolicyScopeType;
  timezoneUsed: string;

  base_fare: Money;
  per_km: Money;
  per_minute: Money;
  minimum_fare: Money;
  booking_fee: Money;
  night_surcharge: Money; // si no lo usas aún, queda 0
  cap: Money | null;
}

export type JsonObject = Record<string, unknown>;

export type ExtraLine = {
  code: string;
  label: string;
  amount: number;
  meta?: JsonObject; // ✅ no null
};

export type FareBreakdown = {
  // IDs / labels (lo que tú ya uses)
  vehicle_type_name?: string;
  service_class_name?: string;
  category_name?: string;

  vehicle_type_id?: string;
  service_class_id?: string;
  category_id?: string;

  // rate card / costos
  base_fare?: number;
  cost_per_km?: number;
  cost_per_minute?: number;
  min_fare?: number;

  // ✅ booking_fee debe ser opcional para que sea asignable al FareBreakdown del Trip
  booking_fee?: number;

  // opcionales típicos de policy
  minimum_fare?: number;
  night_surcharge?: number;
  cap?: number;

  applied_multipliers?: {
    base: number;
    per_km: number;
    per_min: number;
    min_fare: number;
  };

  distance_km_est?: number;
  duration_min_est?: number;

  subtotal?: number;
  total?: number;
  surge_multiplier?: number;

  // extras
  waiting_time_minutes?: number;
  waiting_reason?: string;

  extra_fees_total?: number;
  extra_lines?: ExtraLine[]; // ✅ meta sin null

  // (si agregaste audit info)
  price_policy_id?: string;
  scope_type?: 'GLOBAL' | 'CITY' | 'ZONE';
  city_id?: string;
  zone_id?: string;
};
