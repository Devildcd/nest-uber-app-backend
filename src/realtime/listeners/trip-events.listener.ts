import { OnEvent } from '@nestjs/event-emitter';
import { Injectable, Logger } from '@nestjs/common';
import { TripRealtimePublisher } from '../publishers/trip-realtime.publisher';
import {
  AssigningStartedEvent,
  DriverAcceptedEvent,
  DriverAssignedEvent,
  DriverOfferedEvent,
  DriverRejectedEvent,
  NoDriversFoundEvent,
  TripRequestedEvent,
  TripDomainEvents,
  AssignmentExpiredEvent,
  ArrivingStartedEvent,
  DriverEnRouteEvent,
  DriverArrivedPickupEvent,
  TripStartedEvent,
  TripCompletedEvent,
} from 'src/core/domain/events/trip-domain.events';
import { TripRepository } from 'src/modules/trip/repositories/trip.repository';
import {
  toDriverSlimForPassenger,
  toPassengerSlimForDriver,
  toVehicleSlimForPassenger,
} from 'src/modules/trip/utils/driver-passenger.mappers';
import { PassengerSlimForDriverDto } from 'src/modules/trip/dtos/trip/driver-passenger.dto';

@Injectable()
export class TripEventsListener {
  private readonly logger = new Logger(TripEventsListener.name);

  constructor(
    private readonly publisher: TripRealtimePublisher,
    private readonly tripRepo: TripRepository,
  ) {
    this.logger.log('TripEventsListener initialised');
  }

  // ====== FASE 1: REQUESTED ======
  @OnEvent(TripDomainEvents.TripRequested, { async: true })
  onTripRequested(ev: TripRequestedEvent) {
    this.logger.debug(
      `onTripRequested tripId=${ev.snapshot.tripId} pax=${ev.snapshot.passengerId}`,
    );
    this.publisher.tripRequested(ev);
  }

  // ====== FASE 2: ASSIGNING STARTED ======
  @OnEvent(TripDomainEvents.AssigningStarted, { async: true })
  onAssigningStarted(ev: AssigningStartedEvent) {
    this.logger.debug(
      `onAssigningStarted tripId=${ev.snapshot.tripId} pax=${ev.snapshot.passengerId}`,
    );
    this.publisher.assigningStarted(ev);
  }

  // ====== OFERTA A DRIVER ======
  @OnEvent(TripDomainEvents.DriverOffered, { async: true })
  onDriverOffered(ev: DriverOfferedEvent) {
    this.logger.debug(
      `onDriverOffered tripId=${ev.tripId} driver=${ev.driverId} assignment=${ev.assignmentId}`,
    );
    this.publisher.driverOffered(ev);
  }

  // ====== SIN CONDUCTORES (NDF) ======
  @OnEvent(TripDomainEvents.NoDriversFound, { async: true })
  async onNoDriversFound(ev: NoDriversFoundEvent) {
    this.logger.debug(
      `onNoDriversFound tripId=${ev.tripId} reason=${ev.reason}`,
    );
    const passengerId = await this.getPassengerId(ev.tripId);
    this.publisher.noDriversFound(ev, passengerId);
  }

  @OnEvent(TripDomainEvents.DriverAccepted, { async: true })
  async onDriverAccepted(ev: DriverAcceptedEvent) {
    // cargar trip con relaciones
    const trip = await this.tripRepo.findById(ev.tripId, {
      relations: { passenger: true, driver: true, vehicle: true },
    });
    if (!trip?.passenger?.id) return;

    // (opcional) rating: cuando tengas repo/servicio, obtén {avg, count}
    const rating: { avg: number | null; count: number | null } | null = null;

    const driverSlim = toDriverSlimForPassenger(trip.driver, rating);
    const vehicleSlim = toVehicleSlimForPassenger(trip.vehicle);

    await this.publisher.emitDriverAcceptedToPassenger({
      tripId: ev.tripId,
      at: ev.at,
      driverId: ev.driverId,
      vehicleId: ev.vehicleId,
      passengerId: trip.passenger.id,
      currentStatus: 'accepted',
      driver: driverSlim,
      vehicle: vehicleSlim,
    });
  }

  // Driver asignado -> necesitamos passengerId para avisarle
  @OnEvent(TripDomainEvents.DriverAssigned, { async: true })
  async onDriverAssigned(ev: DriverAssignedEvent) {
    const trip = await this.tripRepo.findById(ev.tripId, {
      relations: { passenger: true },
    });

    const passengerId = trip?.passenger?.id;
    const passengerSlim = toPassengerSlimForDriver(trip?.passenger);

    this.publisher.driverAssigned({
      ...ev,
      passengerId,
      passenger: passengerSlim,
    } as DriverAssignedEvent & {
      passengerId?: string;
      passenger?: PassengerSlimForDriverDto | null;
    });
  }

  // Rechazo de oferta (suele ir solo a admin/monitor)
  @OnEvent(TripDomainEvents.DriverRejected, { async: true })
  onDriverRejected(ev: DriverRejectedEvent) {
    this.publisher.driverRejected(ev);
  }

  // Expiración de oferta (suele ir solo a admin/monitor)
  @OnEvent(TripDomainEvents.AssignmentExpired, { async: true })
  onAssignmentExpired(ev: AssignmentExpiredEvent) {
    this.publisher.assignmentExpired(ev);
  }

  // ====== FASE 4: ARRIVING / EN ROUTE / ARRIVED ======
  @OnEvent(TripDomainEvents.ArrivingStarted, { async: true })
  onArrivingStarted(ev: ArrivingStartedEvent) {
    this.logger.debug(
      `[TripEventsListener] ArrivingStarted trip=${ev.snapshot.tripId} status=${ev.snapshot.currentStatus}`,
    );
    this.publisher.arrivingStarted(ev);
  }

  @OnEvent(TripDomainEvents.DriverEnRoute, { async: true })
  async onDriverEnRoute(ev: DriverEnRouteEvent) {
    this.logger.debug(
      `[TripEventsListener] DriverEnRoute trip=${ev.tripId} driver=${ev.driverId} eta=${ev.etaMinutes ?? 'null'}`,
    );

    const passengerId = await this.getPassengerId(ev.tripId);

    this.publisher.driverEnRoute({
      ...ev,
      passengerId,
    });
  }

  @OnEvent(TripDomainEvents.DriverArrivedPickup, { async: true })
  async onDriverArrivedPickup(ev: DriverArrivedPickupEvent) {
    const passengerId = await this.getPassengerId(ev.tripId);
    this.publisher.driverArrivedPickup({ ...ev, passengerId });
  }

  // ====== FASE 5: STARTED / COMPLETED ======
  @OnEvent(TripDomainEvents.TripStarted, { async: true })
  async onTripStarted(ev: TripStartedEvent) {
    const passengerId = await this.getPassengerId(ev.tripId);
    this.publisher.tripStarted({ ...ev, passengerId });
  }

  @OnEvent(TripDomainEvents.TripCompleted, { async: true })
  async onTripCompleted(ev: TripCompletedEvent) {
    // si el dominio ya trae passengerId, úsalo; si no, lo resolvemos
    const passengerId =
      (ev as any).passengerId ?? (await this.getPassengerId(ev.tripId));
    this.publisher.tripCompleted({ ...ev, passengerId });
  }

  // ------ helper: obtener passengerId sin cargar todo ------
  private async getPassengerId(tripId: string): Promise<string | undefined> {
    try {
      const t = await this.tripRepo.findById(tripId, {
        relations: { passenger: true } as any,
      });
      return t?.passenger?.id;
    } catch (e) {
      this.logger.warn(
        `getPassengerId failed tripId=${tripId}: ${(e as Error).message}`,
      );
      return undefined;
    }
  }
}
