import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DriverAvailabilityEvents,
  StatusUpdatedEvent,
  LocationUpdatedEvent,
  TripUpdatedEvent,
} from 'src/core/domain/events/driver-availability.events';
import { DriverAvailabilityRealtimePublisher } from '../publishers/driver-availability-realtime.publisher';

@Injectable()
export class DriverAvailabilityEventsListener {
  constructor(
    private readonly publisher: DriverAvailabilityRealtimePublisher,
  ) {}

  @OnEvent(DriverAvailabilityEvents.StatusUpdated)
  onStatusUpdated(ev: StatusUpdatedEvent) {
    this.publisher.statusUpdated(ev);
  }

  @OnEvent(DriverAvailabilityEvents.LocationUpdated)
  onLocationUpdated(ev: LocationUpdatedEvent) {
    this.publisher.locationUpdated(ev);
  }

  @OnEvent(DriverAvailabilityEvents.TripUpdated)
  onTripUpdated(ev: TripUpdatedEvent) {
    this.publisher.tripUpdated(ev);
  }
}
