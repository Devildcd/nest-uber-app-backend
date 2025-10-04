import { Logger } from '@nestjs/common';
import { PassengerGateway } from '../gateways/passenger.gateway';
import { AdminGateway } from '../gateways/admin.gateway';
import { DriverAvailabilityGateway as DriverGateway } from '../gateways/driver-availability.gateway';
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
import type { Server } from 'socket.io';

export class TripRealtimePublisher {
  private readonly logger = new Logger(TripRealtimePublisher.name);

  constructor(
    private readonly passengerGateway: PassengerGateway,
    private readonly driverGateway?: DriverGateway, // opcional si quieres emitir a /drivers
    private readonly adminGateway?: AdminGateway, // opcional si quieres espejo en /admin
  ) {}

  // ---------- helpers ----------
  private emitTo(
    server: Server | undefined,
    room: string,
    event: string,
    payload: any,
  ) {
    try {
      server?.to(room).emit(event, payload);
    } catch (e) {
      this.logger.warn(
        `WS emit failed room=${room} evt=${event}: ${(e as Error).message}`,
      );
    }
  }

  // ===== FASE 1 =====
  tripRequested(ev: TripRequestedEvent) {
    const s = ev.snapshot;
    const requestedAt = s.requestedAt ?? ev.at;

    const payload = {
      tripId: s.tripId,
      passengerId: s.passengerId,
      requestedAt,
      fareEstimatedTotal: s.fareEstimatedTotal ?? null,
      fareFinalCurrency: s.fareFinalCurrency ?? null,
      pickup: s.pickup ?? null,
    };

    this.emitTo(
      this.passengerGateway.server,
      `passenger:${s.passengerId}`,
      'trip:requested',
      payload,
    );
    this.emitTo(
      this.adminGateway?.server,
      `trip:${s.tripId}`,
      'trip:requested',
      payload,
    );
  }

  // ===== FASE 2: ASSIGNING =====
  assigningStarted(ev: AssigningStartedEvent) {
    const s = ev.snapshot;
    const payload = {
      tripId: s.tripId,
      at: ev.at,
      previousStatus: 'pending',
      currentStatus: 'assigning',
    };

    this.emitTo(
      this.passengerGateway.server,
      `passenger:${s.passengerId}`,
      'trip:assigning_started',
      payload,
    );
    this.emitTo(
      this.adminGateway?.server,
      `trip:${s.tripId}`,
      'trip:assigning_started',
      payload,
    );
  }

  driverOffered(ev: DriverOfferedEvent) {
    const payload = {
      tripId: ev.tripId,
      assignmentId: ev.assignmentId,
      ttlExpiresAt: ev.ttlExpiresAt,
    };

    this.emitTo(
      this.driverGateway?.server,
      `driver:${ev.driverId}`,
      'trip:assignment:offered',
      payload,
    );

    this.emitTo(
      this.adminGateway?.server,
      `trip:${ev.tripId}`,
      'trip:assignment:offered',
      { ...payload, driverId: ev.driverId, vehicleId: ev.vehicleId },
    );
  }

  driverAccepted(ev: DriverAcceptedEvent) {
    const payload = {
      tripId: ev.tripId,
      assignmentId: ev.assignmentId,
      driverId: ev.driverId,
      vehicleId: ev.vehicleId,
      at: ev.at,
    };

    this.emitTo(
      this.driverGateway?.server,
      `driver:${ev.driverId}`,
      'trip:assignment:accepted',
      payload,
    );
    this.emitTo(
      this.adminGateway?.server,
      `trip:${ev.tripId}`,
      'trip:assignment:accepted',
      payload,
    );
  }

  /** Permite (opcionalmente) pasar passengerId desde el listener */
  driverAssigned(ev: DriverAssignedEvent & { passengerId?: string }) {
    const payload = {
      tripId: ev.tripId,
      driverId: ev.driverId,
      vehicleId: ev.vehicleId,
      at: ev.at,
      currentStatus: 'accepted',
    };

    // passenger (solo si te pasan el id)
    if (ev.passengerId) {
      this.emitTo(
        this.passengerGateway.server,
        `passenger:${ev.passengerId}`,
        'trip:driver_assigned',
        payload,
      );
    }

    // driver eco
    this.emitTo(
      this.driverGateway?.server,
      `driver:${ev.driverId}`,
      'trip:driver_assigned',
      payload,
    );

    // admin/monitor
    this.emitTo(
      this.adminGateway?.server,
      `trip:${ev.tripId}`,
      'trip:driver_assigned',
      payload,
    );
  }

  /** NUEVO: rechazo (normalmente solo admin/metrics) */
  driverRejected(ev: DriverRejectedEvent) {
    const payload = {
      tripId: ev.tripId,
      assignmentId: ev.assignmentId,
      driverId: ev.driverId,
      vehicleId: ev.vehicleId,
      reason: ev.reason ?? null,
      at: ev.at,
    };

    // admin/monitor
    this.emitTo(
      this.adminGateway?.server,
      `trip:${ev.tripId}`,
      'trip:assignment:rejected',
      payload,
    );
  }

  /** NUEVO: expiración (normalmente solo admin/metrics) */
  assignmentExpired(ev: AssignmentExpiredEvent) {
    const payload = {
      tripId: ev.tripId,
      assignmentId: ev.assignmentId,
      driverId: ev.driverId,
      vehicleId: ev.vehicleId,
      at: ev.at,
    };

    // admin/monitor
    this.emitTo(
      this.adminGateway?.server,
      `trip:${ev.tripId}`,
      'trip:assignment:expired',
      payload,
    );
  }

  noDriversFound(ev: NoDriversFoundEvent & { passengerId?: string }) {
    const payload = {
      tripId: ev.tripId,
      at: ev.at,
      reason: ev.reason ?? 'matching_exhausted',
      currentStatus: 'no_drivers_found',
    };

    if (ev.passengerId) {
      this.emitTo(
        this.passengerGateway.server,
        `passenger:${ev.passengerId}`,
        'trip:no_drivers_found',
        payload,
      );
    }

    this.emitTo(
      this.adminGateway?.server,
      `trip:${ev.tripId}`,
      'trip:no_drivers_found',
      payload,
    );
  }

  // === FASE 4 ===
  arrivingStarted(ev: ArrivingStartedEvent) {
    const s = ev.snapshot;
    const payload = {
      tripId: s.tripId,
      at: ev.at,
      previousStatus: 'accepted',
      currentStatus: 'arriving',
    };
    this.emitTo(
      this.passengerGateway.server,
      `passenger:${s.passengerId}`,
      'trip:arriving_started',
      payload,
    );
    this.emitTo(
      this.adminGateway?.server,
      `trip:${s.tripId}`,
      'trip:arriving_started',
      payload,
    );
  }

  /** driver en ruta (ETA/posición) → passenger + eco driver + admin */
  driverEnRoute(ev: DriverEnRouteEvent & { passengerId?: string }) {
    const payload = {
      tripId: ev.tripId,
      at: ev.at,
      etaMinutes: ev.etaMinutes ?? null,
      driverPosition: ev.driverPosition ?? null,
    };

    if (ev.passengerId) {
      this.emitTo(
        this.passengerGateway.server,
        `passenger:${ev.passengerId}`,
        'trip:driver_en_route',
        payload,
      );
    }
    this.emitTo(
      this.driverGateway?.server,
      `driver:${ev.driverId}`,
      'trip:driver_en_route',
      payload,
    );
    this.emitTo(
      this.adminGateway?.server,
      `trip:${ev.tripId}`,
      'trip:driver_en_route',
      { ...payload, driverId: ev.driverId },
    );
  }

  /** conductor llegó al pickup */
  driverArrivedPickup(ev: DriverArrivedPickupEvent & { passengerId?: string }) {
    const payload = {
      tripId: ev.tripId,
      at: ev.at,
      currentStatus: 'arriving',
    };
    if (ev.passengerId) {
      this.emitTo(
        this.passengerGateway.server,
        `passenger:${ev.passengerId}`,
        'trip:driver_arrived_pickup',
        payload,
      );
    }
    this.emitTo(
      this.driverGateway?.server,
      `driver:${ev.driverId}`,
      'trip:driver_arrived_pickup',
      payload,
    );
    this.emitTo(
      this.adminGateway?.server,
      `trip:${ev.tripId}`,
      'trip:driver_arrived_pickup',
      { ...payload, driverId: ev.driverId },
    );
  }

  /** viaje iniciado */
  tripStarted(ev: TripStartedEvent & { passengerId?: string }) {
    const payload = {
      tripId: ev.tripId,
      at: ev.at,
      currentStatus: 'in_progress',
    };
    if (ev.passengerId) {
      this.emitTo(
        this.passengerGateway.server,
        `passenger:${ev.passengerId}`,
        'trip:started',
        payload,
      );
    }
    this.emitTo(
      this.driverGateway?.server,
      `driver:${ev.driverId}`,
      'trip:started',
      payload,
    );
    this.emitTo(
      this.adminGateway?.server,
      `trip:${ev.tripId}`,
      'trip:started',
      { ...payload, driverId: ev.driverId },
    );
  }

  tripCompleted(ev: TripCompletedEvent & { passengerId?: string | null }) {
    const payload = {
      tripId: ev.tripId,
      at: ev.at,
      driverId: ev.driverId,
      currentStatus: 'completed',
      fareTotal: ev.fareTotal,
      currency: ev.currency,
    };

    // passenger (si lo conocemos)
    if (ev.passengerId) {
      this.emitTo(
        this.passengerGateway.server,
        `passenger:${ev.passengerId}`,
        'trip:completed',
        payload,
      );
    }

    // driver (eco)
    this.emitTo(
      this.driverGateway?.server,
      `driver:${ev.driverId}`,
      'trip:completed',
      payload,
    );

    // admin/monitor (sala por trip)
    this.emitTo(
      this.adminGateway?.server,
      `trip:${ev.tripId}`,
      'trip:completed',
      payload,
    );
  }
}
