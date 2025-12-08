import { Injectable, Logger } from '@nestjs/common';
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
import { Rooms } from '../rooms/ws-topics';
import { WsServersRegistry } from '../ws-servers.registry';
import { DriverAvailabilityGateway } from '../gateways/driver-availability.gateway';
import { DriverAcceptedForPassengerPayload } from '../interfaces/trip-ws.payloads';
import { PassengerSlimForDriverDto } from 'src/modules/trip/dtos/trip/driver-passenger.dto';

type Ns = '/passengers' | '/drivers' | '/admin';
type DriverEnRouteRealtimePayload = DriverEnRouteEvent & {
  passengerId?: string;
};

@Injectable()
export class TripRealtimePublisher {
  private readonly logger = new Logger(TripRealtimePublisher.name);

  constructor(
    private readonly wsRegistry: WsServersRegistry,
    private readonly driversGw: DriverAvailabilityGateway,
  ) {}

  // ---------- helpers ----------
  private emitTo(ns: Ns, room: string, event: string, payload: any) {
    const server = this.wsRegistry.get(ns);
    if (!server) {
      this.logger.warn(
        `WS emit skipped (server undefined) ns=${ns} room=${room} evt=${event}`,
      );
      return;
    }

    try {
      // 🔎 Identidad del server (para detectar instancias distintas)
      const serverId = String(server as any);

      // 🔢 Tamaño del room (rápido, sin promesas)
      const sizeQuick =
        (server.sockets as any)?.adapter?.rooms?.get(room)?.size ?? 0;

      this.logger.debug(
        `[WS] emitTo[quick] ns=${ns} room=${room} size=${sizeQuick} evt=${event} server=${serverId}`,
      );

      // 🔍 Confirmación con fetchSockets (más precisa, async)
      server
        .in(room)
        .fetchSockets()
        .then((sockets) => {
          this.logger.debug(
            `[WS] emitTo[fetch] ns=${ns} room=${room} clients=${sockets.length} evt=${event} server=${serverId}`,
          );
        })
        .catch(() => {
          /* noop */
        });

      // 🛰️ (Opcional) broadcast de debug al namespace para verlo en el frontend
      // (tu DriverWsService ya hace: socket.on('debug:offered:broadcast', ...)
      server.emit('debug:offered:broadcast', {
        ns,
        room,
        event,
        serverId,
        payload,
      });

      // 📤 Emit real al room
      server.to(room).emit(event, payload);

      this.logger.debug(
        `[WS] emit ok ns=${ns} room=${room} evt=${event} server=${serverId}`,
      );
    } catch (e) {
      this.logger.warn(
        `WS emit failed ns=${ns} room=${room} evt=${event}: ${(e as Error).message}`,
      );
    }
  }

  // ========== FASE 1 ==========
  tripRequested(ev: TripRequestedEvent) {
    const s = ev.snapshot;
    const payload = {
      tripId: s.tripId,
      passengerId: s.passengerId,
      requestedAt: s.requestedAt ?? ev.at,
      pickup: s.pickup ?? null,
      fareEstimatedTotal: s.fareEstimatedTotal ?? null,
      fareFinalCurrency: s.fareFinalCurrency ?? null,
      status: 'pending',
    };

    this.logger.log(
      `[PUB] trip:requested -> ${Rooms.passenger(s.passengerId)} trip=${s.tripId}`,
    );

    this.emitTo(
      '/passengers',
      Rooms.passenger(s.passengerId),
      'trip:requested',
      payload,
    );
    this.emitTo('/admin', Rooms.trip(s.tripId), 'trip:requested', payload);
  }

  assigningStarted(ev: AssigningStartedEvent) {
    const s = ev.snapshot;
    const payload = {
      tripId: s.tripId,
      at: ev.at,
      previousStatus: 'pending',
      currentStatus: 'assigning',
    };

    this.logger.log(
      `[PUB] trip:assigning_started -> ${Rooms.passenger(s.passengerId)} trip=${s.tripId}`,
    );

    this.emitTo(
      '/passengers',
      Rooms.passenger(s.passengerId),
      'trip:assigning_started',
      payload,
    );
    this.emitTo(
      '/admin',
      Rooms.trip(s.tripId),
      'trip:assigning_started',
      payload,
    );
  }

  // ========== OFERTA A DRIVER ==========
  driverOffered(ev: DriverOfferedEvent) {
    const ttlSec = Math.max(
      0,
      Math.round((Date.parse(ev.ttlExpiresAt) - Date.now()) / 1000),
    );
    const payloadForDriver = {
      assignmentId: ev.assignmentId,
      tripId: ev.tripId,
      ttlSec,
      expiresAt: ev.ttlExpiresAt,
    };

    this.logger.log(
      `[PUB] trip:assignment:offered -> ${Rooms.driver(ev.driverId)} trip=${ev.tripId}`,
    );

    const server = this.wsRegistry.get('/drivers');
    server?.emit('debug:offered:broadcast', {
      room: Rooms.driver(ev.driverId),
      ...payloadForDriver,
    }); // 👈 DEBUG
    this.emitTo(
      '/drivers',
      Rooms.driver(ev.driverId),
      'trip:assignment:offered',
      payloadForDriver,
    );

    try {
      this.driversGw.server
        .to(Rooms.driver(ev.driverId))
        .emit('trip:assignment:offered', payloadForDriver);
    } catch {}

    this.emitTo('/admin', Rooms.trip(ev.tripId), 'trip:assignment:offered', {
      ...payloadForDriver,
      driverId: ev.driverId,
      vehicleId: ev.vehicleId,
    });
  }

  // =============== SIN CONDUCTORES (NDF) ===============
  noDriversFound(ev: NoDriversFoundEvent, passengerId?: string) {
    const payload = { at: ev.at, tripId: ev.tripId, reason: ev.reason };

    this.logger.log(
      `[PUB] trip:no_drivers_found -> trip:${ev.tripId} (passenger? ${!!passengerId})`,
    );

    if (passengerId) {
      this.emitTo(
        '/passengers',
        Rooms.passenger(passengerId),
        'trip:no_drivers_found',
        payload,
      );
    }
    this.emitTo(
      '/admin',
      Rooms.trip(ev.tripId),
      'trip:no_drivers_found',
      payload,
    );
  }

  // ====== ACEPTADO / ASIGNADO / RECHAZADO / EXPIRADO ======
  driverAccepted(ev: DriverAcceptedEvent) {
    const payload = {
      tripId: ev.tripId,
      assignmentId: ev.assignmentId,
      driverId: ev.driverId,
      vehicleId: ev.vehicleId,
      at: ev.at,
    };

    this.emitTo(
      '/drivers',
      Rooms.driver(ev.driverId),
      'trip:assignment:accepted',
      payload,
    );
    this.emitTo(
      '/admin',
      Rooms.trip(ev.tripId),
      'trip:assignment:accepted',
      payload,
    );
  }

  driverAssigned(
    ev: DriverAssignedEvent & {
      passengerId?: string;
      passenger?: PassengerSlimForDriverDto | null;
    },
  ) {
    const basePayload = {
      tripId: ev.tripId,
      driverId: ev.driverId,
      vehicleId: ev.vehicleId,
      at: ev.at,
      currentStatus: 'accepted',
    };

    // Para passenger/admin puedes seguir enviando lo de siempre
    if (ev.passengerId) {
      this.emitTo(
        '/passengers',
        Rooms.passenger(ev.passengerId),
        'trip:driver_assigned',
        basePayload,
      );
    }

    // 👉 Para el driver añadimos la info del pasajero
    const payloadForDriver = {
      ...basePayload,
      passenger: ev.passenger ?? null,
    };

    this.emitTo(
      '/drivers',
      Rooms.driver(ev.driverId),
      'trip:driver_assigned',
      payloadForDriver,
    );

    this.emitTo('/admin', Rooms.trip(ev.tripId), 'trip:driver_assigned', {
      ...payloadForDriver,
      passengerId: ev.passengerId ?? null,
    });
  }

  async emitDriverAcceptedToPassenger(
    p: DriverAcceptedForPassengerPayload,
  ): Promise<void> {
    const server = this.wsRegistry.get('/passengers');
    const room = `passenger:${p.passengerId}`;
    const evt1 = 'trip:driver_accepted';
    const evt2 = 'trip:driver_assigned'; // espejo opcional

    if (!server) {
      this.logger.warn(
        `[WS] /passengers server undefined. Skip emit ${evt1} room=${room}`,
      );
      return;
    }

    try {
      // 🔎 Identificador del server (útil si tienes múltiples instancias)
      const serverId = String(server as any);

      // 🔢 Tamaño rápido del room (sin promesas)
      const sizeQuick =
        (server.sockets as any)?.adapter?.rooms?.get(room)?.size ?? 0;
      this.logger.debug(
        `[WS] emitDriverAcceptedToPassenger[quick] room=${room} size=${sizeQuick} trip=${p.tripId} server=${serverId}`,
      );

      // 🔍 Confirmación precisa (async)
      try {
        const sockets = await server.in(room).fetchSockets();
        this.logger.debug(
          `[WS] emitDriverAcceptedToPassenger[fetch] room=${room} clients=${sockets.length} trip=${p.tripId} server=${serverId}`,
        );
      } catch {
        /* noop */
      }

      // 📤 Emit principal
      this.logger.log(`[PUB] ${evt1} -> ${room} trip=${p.tripId}`);
      server.to(room).emit(evt1, {
        tripId: p.tripId,
        at: p.at,
        currentStatus: p.currentStatus,
        driver: p.driver,
        vehicle: p.vehicle,
      });
      this.logger.debug(
        `[WS] emit ok evt=${evt1} room=${room} trip=${p.tripId}`,
      );

      // 📤 (Opcional) espejo con el evento que ya usabas
      this.logger.log(`[PUB] ${evt2} (mirror) -> ${room} trip=${p.tripId}`);
      server.to(room).emit(evt2, {
        tripId: p.tripId,
        at: p.at,
        currentStatus: p.currentStatus,
        driver: p.driver,
        vehicle: p.vehicle,
      });
      this.logger.debug(
        `[WS] emit ok evt=${evt2} room=${room} trip=${p.tripId}`,
      );
    } catch (e) {
      this.logger.warn(
        `[WS] emitDriverAcceptedToPassenger failed room=${room} trip=${p.tripId}: ${(e as Error).message}`,
      );
    }
  }

  driverRejected(ev: DriverRejectedEvent) {
    const payload = {
      tripId: ev.tripId,
      assignmentId: ev.assignmentId,
      driverId: ev.driverId,
      vehicleId: ev.vehicleId,
      reason: ev.reason ?? null,
      at: ev.at,
    };
    this.emitTo(
      '/admin',
      Rooms.trip(ev.tripId),
      'trip:assignment:rejected',
      payload,
    );
  }

  assignmentExpired(ev: AssignmentExpiredEvent) {
    const payload = {
      tripId: ev.tripId,
      assignmentId: ev.assignmentId,
      driverId: ev.driverId,
      vehicleId: ev.vehicleId,
      at: ev.at,
    };
    this.emitTo(
      '/admin',
      Rooms.trip(ev.tripId),
      'trip:assignment:expired',
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
      '/passengers',
      Rooms.passenger(s.passengerId),
      'trip:arriving_started',
      payload,
    );

    if (s.driverId) {
      this.emitTo(
        '/drivers',
        Rooms.driver(s.driverId),
        'trip:arriving_started',
        payload,
      );
    }

    this.emitTo(
      '/admin',
      Rooms.trip(s.tripId),
      'trip:arriving_started',
      payload,
    );
  }

  driverEnRoute(ev: DriverEnRouteEvent & { passengerId?: string }) {
    const payload = {
      tripId: ev.tripId,
      at: ev.at,
      etaMinutes: ev.etaMinutes ?? null,
      driverPosition: ev.driverPosition ?? null,
    };

    this.logger.debug(
      `[PUB] driverEnRoute trip=${ev.tripId} driver=${ev.driverId} eta=${payload.etaMinutes} pos=${payload.driverPosition ? JSON.stringify(payload.driverPosition) : 'null'}`,
    );

    if (ev.passengerId) {
      this.emitTo(
        '/passengers',
        Rooms.passenger(ev.passengerId),
        'trip:driver_en_route',
        payload,
      );
    }

    this.emitTo(
      '/drivers',
      Rooms.driver(ev.driverId),
      'trip:driver_en_route',
      payload,
    );

    this.emitTo('/admin', Rooms.trip(ev.tripId), 'trip:driver_en_route', {
      ...payload,
      driverId: ev.driverId,
    });
  }

  driverArrivedPickup(ev: DriverArrivedPickupEvent & { passengerId?: string }) {
    const payload = { tripId: ev.tripId, at: ev.at, currentStatus: 'arriving' };
    if (ev.passengerId)
      this.emitTo(
        '/passengers',
        Rooms.passenger(ev.passengerId),
        'trip:driver_arrived_pickup',
        payload,
      );
    this.emitTo(
      '/drivers',
      Rooms.driver(ev.driverId),
      'trip:driver_arrived_pickup',
      payload,
    );
    this.emitTo('/admin', Rooms.trip(ev.tripId), 'trip:driver_arrived_pickup', {
      ...payload,
      driverId: ev.driverId,
    });
  }

  tripStarted(ev: TripStartedEvent & { passengerId?: string }) {
    const payload = {
      tripId: ev.tripId,
      at: ev.at,
      currentStatus: 'in_progress',
    };
    if (ev.passengerId)
      this.emitTo(
        '/passengers',
        Rooms.passenger(ev.passengerId),
        'trip:started',
        payload,
      );
    this.emitTo('/drivers', Rooms.driver(ev.driverId), 'trip:started', payload);
    this.emitTo('/admin', Rooms.trip(ev.tripId), 'trip:started', {
      ...payload,
      driverId: ev.driverId,
    });
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
    if (ev.passengerId)
      this.emitTo(
        '/passengers',
        Rooms.passenger(ev.passengerId),
        'trip:completed',
        payload,
      );
    this.emitTo(
      '/drivers',
      Rooms.driver(ev.driverId),
      'trip:completed',
      payload,
    );
    this.emitTo('/admin', Rooms.trip(ev.tripId), 'trip:completed', payload);
  }
}
