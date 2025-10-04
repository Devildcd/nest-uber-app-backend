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

@Injectable()
export class TripEventsListener {
  private readonly logger = new Logger(TripEventsListener.name);

  constructor(
    private readonly publisher: TripRealtimePublisher,
    private readonly tripRepo: TripRepository,
  ) {}

  @OnEvent(TripDomainEvents.TripRequested, { async: true })
  onTripRequested(ev: TripRequestedEvent) {
    this.publisher.tripRequested(ev); // ← le pasamos el evento completo
  }

  @OnEvent(TripDomainEvents.AssigningStarted, { async: true })
  onAssigningStarted(ev: AssigningStartedEvent) {
    this.publisher.assigningStarted(ev); // → passenger
  }

  @OnEvent(TripDomainEvents.DriverOffered, { async: true })
  onDriverOffered(ev: DriverOfferedEvent) {
    this.publisher.driverOffered(ev); // → driver
  }

  @OnEvent(TripDomainEvents.DriverAccepted, { async: true })
  onDriverAccepted(ev: DriverAcceptedEvent) {
    this.publisher.driverAccepted(ev); // → trip room (y/o passenger)
  }

  @OnEvent(TripDomainEvents.DriverAssigned, { async: true })
  async onDriverAssigned(ev: DriverAssignedEvent) {
    const passengerId = await this.getPassengerId(ev.tripId);
    this.publisher.driverAssigned({ ...ev, passengerId });
  }

  @OnEvent(TripDomainEvents.DriverRejected, { async: true })
  onDriverRejected(ev: DriverRejectedEvent) {
    this.publisher.driverRejected(ev); // (opcional) admin/metrics; normalmente no al passenger
  }

  @OnEvent(TripDomainEvents.AssignmentExpired, { async: true })
  onAssignmentExpired(ev: AssignmentExpiredEvent) {
    this.publisher.assignmentExpired(ev); // (opcional) admin/metrics
  }

  @OnEvent(TripDomainEvents.NoDriversFound, { async: true })
  async onNoDriversFound(ev: NoDriversFoundEvent) {
    const passengerId = await this.getPassengerId(ev.tripId);
    this.publisher.noDriversFound({ ...ev, passengerId });
  }

  @OnEvent(TripDomainEvents.ArrivingStarted, { async: true })
  onArrivingStarted(ev: ArrivingStartedEvent) {
    this.publisher.arrivingStarted(ev);
  }

  @OnEvent(TripDomainEvents.DriverEnRoute, { async: true })
  async onDriverEnRoute(ev: DriverEnRouteEvent) {
    const passengerId = await this.getPassengerId(ev.tripId);
    this.publisher.driverEnRoute({ ...ev, passengerId });
  }

  @OnEvent(TripDomainEvents.DriverArrivedPickup, { async: true })
  async onDriverArrivedPickup(ev: DriverArrivedPickupEvent) {
    const passengerId = await this.getPassengerId(ev.tripId);
    this.publisher.driverArrivedPickup({ ...ev, passengerId });
  }

  @OnEvent(TripDomainEvents.TripStarted, { async: true })
  async onTripStarted(ev: TripStartedEvent) {
    const passengerId = await this.getPassengerId(ev.tripId);
    this.publisher.tripStarted({ ...ev, passengerId });
  }

  // --- helper: obtener passengerId sin cargar todo ---
  private async getPassengerId(tripId: string): Promise<string | undefined> {
    try {
      // carga mínima; suficiente con la relación passenger
      const t = await this.tripRepo.findById(tripId, {
        relations: { passenger: true, driver: false, vehicle: false } as any,
      });
      return t?.passenger?.id;
    } catch (e) {
      this.logger.warn(
        `getPassengerId failed tripId=${tripId}: ${(e as Error).message}`,
      );
      return undefined;
    }
  }

  @OnEvent(TripDomainEvents.TripCompleted, { async: true })
  async onTripCompleted(ev: TripCompletedEvent) {
    // si no viene en el evento, lo resolvemos igual que en los otros
    const passengerId =
      ev.passengerId ?? (await this.getPassengerId(ev.tripId));

    this.publisher.tripCompleted({ ...ev, passengerId });
  }
}
