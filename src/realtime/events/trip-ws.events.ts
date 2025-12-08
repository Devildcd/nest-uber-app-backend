export enum TripWsEvents {
  // ==== Pasajero (room: passenger:{userId}) ====
  Passenger_TripRequested = 'trip:requested',
  Passenger_Assigning = 'trip:assigning', // (mantengo tu nombre)
  Passenger_Assigned = 'trip:assigned',
  Passenger_NoDriversFound = 'trip:no_drivers_found',

  // ==== Conductor (room: driver:{userId}) ====
  Driver_Offer = 'trip:offer', // oferta creada
  Driver_OfferCancelled = 'trip:offer:cancelled',
  Driver_OfferExpired = 'trip:offer:expired',

  // Driver → Server (inbound desde app del conductor)
  Driver_AcceptOffer = 'driver:offer:accept', // inbound
  Driver_RejectOffer = 'driver:offer:reject', // inbound

  // ==== Admin (/admin broadcast o room trip:{tripId}) ====
  Admin_AssignmentOffered = 'assignment:offered',
  Admin_TripAssigned = 'trip:assigned',
  Admin_NoDriversFound = 'trip:no_drivers_found',
}

// Payloads WS mínimos
export type WsTripAssigningPayload = {
  tripId: string;
  status: 'assigning';
};

export type WsDriverOfferPayload = {
  assignmentId: string;
  tripId: string;
  pickup: { lat: number; lng: number; address?: string | null };
  stopsCount?: number;
  priceEstimate?: number | null;
  currency?: string | null;
  ttlSec: number;
};

export type WsPassengerAssignedPayload = {
  tripId: string;
  driver: { id: string; name?: string | null };
  vehicle: { id: string; plate?: string | null };
  etaMin?: number | null; // si luego calculas ETA, rellénalo
};

export type WsNoDriversFoundPayload = {
  tripId: string;
  reason?: string;
};
