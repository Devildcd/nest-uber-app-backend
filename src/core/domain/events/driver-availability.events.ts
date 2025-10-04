// Eventos de dominio (no conocen de WS)
export enum DriverAvailabilityEvents {
  StatusUpdated = 'driver_availability.status_updated',
  LocationUpdated = 'driver_availability.location_updated',
  TripUpdated = 'driver_availability.trip_updated',
}

export type AvailabilitySnapshot = {
  driverId: string;
  isOnline: boolean;
  isAvailableForTrips: boolean;
  availabilityReason: 'OFFLINE' | 'UNAVAILABLE' | 'ON_TRIP' | null;
  currentTripId: string | null;
  currentVehicleId: string | null;
  lastLocation?: { lat: number; lng: number } | null;
  lastLocationTimestamp?: string | null;
  lastOnlineTimestamp?: string | null;
  updatedAt: string;
};

export type StatusUpdatedEvent = { at: string; snapshot: AvailabilitySnapshot };
export type LocationUpdatedEvent = {
  at: string;
  snapshot: AvailabilitySnapshot;
};
export type TripUpdatedEvent = { at: string; snapshot: AvailabilitySnapshot };
