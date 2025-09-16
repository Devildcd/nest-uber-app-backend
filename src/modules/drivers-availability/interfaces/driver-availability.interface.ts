export interface GeoPoint {
  type: 'Point';
  // [lon, lat] en WGS84 (SRID 4326)
  coordinates: [number, number];
}

export interface Coordinates {
  lat: number;
  lon: number;
}

// -------- Shared types --------
export type AvailabilityReason = 'OFFLINE' | 'ON_TRIP' | 'UNAVAILABLE';

// export interface GeoPoint {
//   lat: number;
//   lng: number;
// }

// -------- Read model --------
export interface DriverAvailability {
  id: string;
  driverId: string;

  isOnline: boolean;
  isAvailableForTrips: boolean;

  lastLocation: GeoPoint | null;
  lastLocationTimestamp: string | null;
  lastPresenceTimestamp: string | null;

  currentTripId: string | null;
  currentVehicleId: string | null;

  lastOnlineTimestamp: string | null;
  availabilityReason: AvailabilityReason | null;

  updatedAt: string;
  deletedAt: string | null;
}

// -------- List projection --------
export interface DriverAvailabilityListItemProjection {
  id: string;
  driverId: string;

  isOnline: boolean;
  isAvailableForTrips: boolean;

  currentTripId: string | null;
  currentVehicleId: string | null;
  availabilityReason: AvailabilityReason | null;

  lastLocationTimestamp: string | null; // ISO 8601
  lastPresenceTimestamp: string | null; // ISO 8601
  updatedAt: string; // ISO 8601
}

// -------- Update input (server-managed reason: no incluir) --------
export interface DriverAvailabilityUpdate {
  driverId: string;

  isOnline?: boolean;
  isAvailableForTrips?: boolean;

  lastLocation?: GeoPoint;
  lastLocationTimestamp?: string; // ISO 8601
  lastPresenceTimestamp?: string; // ISO 8601

  currentTripId?: string | null;
  currentVehicleId?: string | null;

  lastOnlineTimestamp?: string; // ISO 8601

  // availabilityReason es calculada por el servidor → no exponer aquí
}

export interface DriverLocationUpdate {
  driverId: string;
  coords: Coordinates;
  timestamp: string; // ISO 8601
}

export interface FindNearbyAvailableParams {
  lon: number;
  lat: number;
  radiusMeters?: number; // default sugerido: 2000
  limit?: number; // default sugerido: 50
}
