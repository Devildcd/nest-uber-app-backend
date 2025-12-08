import {
  DriverSlimForPassengerDto,
  VehicleSlimForPassengerDto,
} from 'src/modules/trip/dtos/trip/driver-passenger.dto';

// ---- Pasajero
export type WsTripRequestedPayload = {
  tripId: string;
  passengerId: string;
  requestedAt: string; // ISO
  fareEstimatedTotal?: number | null;
  currency?: string | null;
  pickup?: { lat: number; lng: number; address?: string | null } | null;
};

export type DriverAcceptedForPassengerPayload = {
  tripId: string;
  at: string;
  driverId: string;
  vehicleId: string;
  passengerId: string;
  currentStatus: 'accepted';
  driver: DriverSlimForPassengerDto | null;
  vehicle: VehicleSlimForPassengerDto | null;
};

export type WsTripAssigningPayload = {
  tripId: string;
  status: 'assigning';
  at: string; // ISO del cambio a assigning
};

export type WsPassengerAssignedPayload = {
  tripId: string;
  driver: { id: string; name?: string | null };
  vehicle: { id: string; plate?: string | null };
  etaMin?: number | null;
};

// ---- Conductor (oferta)
export type WsDriverOfferPayload = {
  assignmentId: string;
  tripId: string;

  // contexto mínimo para decidir
  pickup: { lat: number; lng: number; address?: string | null };
  destinationHint?: {
    lat: number;
    lng: number;
    address?: string | null;
  } | null;
  stopsCount?: number;

  // preferencia del pasajero
  vehicleCategoryId?: string | null;
  serviceClassId?: string | null;

  // dinero + expiración
  priceEstimate?: number | null;
  currency?: string | null;
  ttlSec: number; // segundos restantes
  expiresAt: string; // ISO absoluto (calcula desde DB)
};

// ---- No drivers
export type WsNoDriversFoundPayload = {
  tripId: string;
  reason?: string;
  at: string; // ISO
};

// ---- Admin
export type WsAdminAssignmentOfferedPayload = {
  tripId: string;
  assignmentId: string;
  driverId: string;
  vehicleId: string;
  expiresAt: string; // ISO
};

// ---- Inbound Driver -> Server (ACK/acciones)
export type DriverAcceptOfferDto = {
  assignmentId: string;
  // opcional: deviceTs, location… si quisieras
};

export type DriverRejectOfferDto = {
  assignmentId: string;
  reason?: 'busy' | 'distance' | 'price' | 'other';
};
