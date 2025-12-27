export type JsonObject = Record<string, unknown>;
export type PriceScopeType = 'GLOBAL' | 'CITY' | 'ZONE';

export type RateCard = {
  policyId: string;
  scopeType: PriceScopeType;
  timezoneUsed: string;

  // ✅ en esta versión: FACTORES (multiplicadores)
  base_fare: number; // default 1
  per_km: number; // default 1
  per_minute: number; // default 1
  minimum_fare: number; // default 1

  // ✅ montos fijos
  booking_fee: number; // default 0
  night_surcharge: number; // default 0

  cap: number | null;
};

export type FareExtraLine = {
  code: string;
  label: string;
  amount: number;
  meta?: JsonObject; // ✅ nunca null
};

export interface FareBreakdown {
  // ===== REQUIRED (front ya los usa) =====
  base_fare: number;
  cost_per_km: number;
  cost_per_minute: number;
  min_fare: number;

  applied_multipliers: {
    base: number;
    per_km: number;
    per_min: number;
    min_fare: number;
  };

  distance_km_est: number;
  duration_min_est: number;

  subtotal: number;
  total: number;
  surge_multiplier: number;

  vehicle_type_name: string;
  service_class_name: string;
  category_name: string;

  // ===== metadata opcional =====
  vehicle_type_id?: string;
  service_class_id?: string;
  category_id?: string;

  booking_fee?: number;
  discounts?: number;
  waiting_time_minutes?: number;

  extra_fees_total?: number;
  waiting_reason?: string;
  extra_lines?: FareExtraLine[];

  // ===== opcional pricing/policy =====
  price_policy_id?: string;
  price_scope_type?: PriceScopeType;
  timezone_used?: string;
  rate_card?: RateCard;
}
