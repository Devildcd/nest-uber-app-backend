export enum TripDomainEvents {
  TripRequested = 'trip.requested',
  AssigningStarted = 'trip.assigning.started',
  DriverOffered = 'trip.assignment.offered',
  DriverAccepted = 'trip.assignment.accepted',
  DriverRejected = 'trip.assignment.rejected',
  AssignmentExpired = 'trip.assignment.expired',
  DriverAssigned = 'trip.driver.assigned',
  NoDriversFound = 'trip.no_drivers_found',
  // Fase 4
  ArrivingStarted = 'trip.arriving.started',
  DriverEnRoute = 'trip.driver.en_route',
  DriverArrivedPickup = 'trip.driver.arrived_pickup',
  TripStarted = 'trip.started',
  TripCompleted = 'trip.completed',
}

// Proyección mínima del trip para eventos (ajústala a tu DTO)
export type TripSnapshot = {
  tripId: string;
  passengerId: string;
  driverId: string | null;
  vehicleId: string | null;
  currentStatus:
    | 'pending'
    | 'assigning'
    | 'accepted'
    | 'arriving'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'no_drivers_found';
  pickup?: { lat: number; lng: number; address?: string | null } | null;
  fareEstimatedTotal?: number | null;
  fareFinalCurrency?: string | null;
  requestedAt?: string | null;
  updatedAt?: string | null;
};

// Payloads de eventos de dominio
export type TripRequestedEvent = { at: string; snapshot: TripSnapshot };
export type AssigningStartedEvent = { at: string; snapshot: TripSnapshot };

export type DriverOfferedEvent = {
  at: string;
  tripId: string;
  assignmentId: string;
  driverId: string;
  vehicleId: string;
  ttlExpiresAt: string; // ISO
};

export type DriverAcceptedEvent = {
  at: string;
  tripId: string;
  assignmentId: string;
  driverId: string;
  vehicleId: string;
};

export type DriverRejectedEvent = {
  at: string;
  tripId: string;
  assignmentId: string;
  driverId: string;
  vehicleId: string;
  reason?: string | null;
};

export type AssignmentExpiredEvent = {
  at: string;
  tripId: string;
  assignmentId: string;
  driverId: string;
  vehicleId: string;
};

export type DriverAssignedEvent = {
  at: string;
  tripId: string;
  driverId: string;
  vehicleId: string;
};

export type NoDriversFoundEvent = {
  at: string;
  tripId: string;
  reason?: string;
};

export type ArrivingStartedEvent = {
  at: string;
  snapshot: TripSnapshot;
};

export type DriverEnRouteEvent = {
  at: string;
  tripId: string;
  driverId: string;
  etaMinutes?: number | null;
  driverPosition?: { lat: number; lng: number } | null;
};

export type DriverArrivedPickupEvent = {
  at: string;
  tripId: string;
  driverId: string;
};

export type TripStartedEvent = {
  at: string;
  tripId: string;
  driverId: string;
};

export type TripCompletedEvent = {
  at: string;
  tripId: string;
  driverId: string;
  passengerId?: string | null;
  fareTotal: number;
  currency: string;
};
