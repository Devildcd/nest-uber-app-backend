import {
  ArrivingStartedEvent,
  AssigningStartedEvent,
  AssignmentExpiredEvent,
  DriverAcceptedEvent,
  DriverArrivedPickupEvent,
  DriverAssignedEvent,
  DriverEnRouteEvent,
  DriverOfferedEvent,
  DriverRejectedEvent,
  NoDriversFoundEvent,
  TripCompletedEvent,
  TripRequestedEvent,
  TripStartedEvent,
} from 'src/core/domain/events/trip-domain.events';
import {
  WsDriverOfferPayload,
  WsNoDriversFoundPayload,
  WsPassengerAssignedPayload,
  WsTripAssigningPayload,
} from '../interfaces/trip-ws.payloads';

export type TripWsMapperDeps = {
  // Debe devolver: pickupPoint (GeoJSON Point), pickupAddress?, stops[], fare?
  loadTripMinimal: (tripId: string) => Promise<{
    id: string;
    pickupPoint: { coordinates: [number, number] }; // [lng, lat]
    pickupAddress?: string | null;
    stops?: Array<any>;
    fare?: { currency?: string | null; estimatedTotal?: number | null };
  } | null>;
};

export const TripWsMapper = {
  // // ---------- Pasajero ----------
  // requested(ev: TripRequestedEvent): WsTripRequestedPayload {
  //   const s = ev.snapshot;
  //   return {
  //     tripId: s.tripId,
  //     passengerId: s.passengerId,
  //     requestedAt: s.requestedAt ?? ev.at,
  //     fareEstimatedTotal: s.fareEstimatedTotal ?? null,
  //     currency: s.fareFinalCurrency ?? null,
  //     pickup: s.pickup ?? null, // { lat, lng, address? } si ya lo traes en snapshot
  //   };
  // },
  // assigning(
  //   ev: AssigningStartedEvent,
  //   passengerId: string,
  // ): WsTripAssigningPayload & { passengerId: string } {
  //   return {
  //     passengerId,
  //     tripId: ev.snapshot.tripId,
  //     status: 'assigning',
  //     at: ev.at,
  //   };
  // },
  // // ---------- Conductor ----------
  // async driverOffer(
  //   ev: DriverOfferedEvent,
  //   deps: TripWsMapperDeps,
  // ): Promise<WsDriverOfferPayload & { driverId: string }> {
  //   const trip = await deps.loadTripMinimal(ev.tripId);
  //   const lng = trip?.pickupPoint?.coordinates?.[0];
  //   const lat = trip?.pickupPoint?.coordinates?.[1];
  //   // TTL restante en segundos (por si el driver se conecta tarde)
  //   const ttlMs = new Date(ev.ttlExpiresAt).getTime() - Date.now();
  //   const ttlSec = Math.max(0, Math.floor(ttlMs / 1000));
  //   return {
  //     driverId: ev.driverId,
  //     assignmentId: ev.assignmentId,
  //     tripId: ev.tripId,
  //     pickup: {
  //       lat: typeof lat === 'number' ? lat : 0,
  //       lng: typeof lng === 'number' ? lng : 0,
  //       address: trip?.pickupAddress ?? null,
  //     },
  //     stopsCount: trip?.stops?.length ?? undefined,
  //     priceEstimate: trip?.fare?.estimatedTotal ?? null,
  //     currency: trip?.fare?.currency ?? null,
  //     ttlSec,
  //   };
  // },
  // // (Opcional) para ACK del driver → pasajero
  // driverAccepted(_ev: DriverAcceptedEvent, _deps: TripWsMapperDeps) {
  //   // Si luego necesitas un payload específico, mapea aquí.
  //   return { ok: true } as const;
  // },
  // driverAssigned(
  //   ev: DriverAssignedEvent,
  //   passengerId: string,
  //   details: { driverName?: string | null; vehiclePlate?: string | null } = {},
  // ): WsPassengerAssignedPayload & { passengerId: string } {
  //   return {
  //     passengerId,
  //     tripId: ev.tripId,
  //     driver: { id: ev.driverId, name: details.driverName ?? null },
  //     vehicle: { id: ev.vehicleId, plate: details.vehiclePlate ?? null },
  //     etaMin: null, // si luego calculas ETA, ajusta aquí
  //   };
  // },
  // driverRejected(_ev: DriverRejectedEvent) {
  //   return { ok: true } as const;
  // },
  // assignmentExpired(_ev: AssignmentExpiredEvent) {
  //   return { ok: true } as const;
  // },
  // noDriversFound(
  //   ev: NoDriversFoundEvent,
  //   passengerId: string,
  // ): WsNoDriversFoundPayload & { passengerId: string } {
  //   return {
  //     passengerId,
  //     tripId: ev.tripId,
  //     reason: ev.reason,
  //   };
  // },
  // arrivingStarted(_ev: ArrivingStartedEvent) {
  //   return { ok: true } as const;
  // },
  // driverEnRoute(_ev: DriverEnRouteEvent, passengerId: string) {
  //   return { passengerId, ok: true } as const;
  // },
  // driverArrivedPickup(_ev: DriverArrivedPickupEvent, passengerId: string) {
  //   return { passengerId, ok: true } as const;
  // },
  // tripStarted(_ev: TripStartedEvent, passengerId: string) {
  //   return { passengerId, ok: true } as const;
  // },
  // tripCompleted(_ev: TripCompletedEvent, passengerId: string) {
  //   return { passengerId, ok: true } as const;
  // },
};
