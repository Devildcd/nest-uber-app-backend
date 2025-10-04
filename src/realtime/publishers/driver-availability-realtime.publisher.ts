import { Injectable, Logger } from '@nestjs/common';
import { DriverAvailabilityGateway } from '../gateways/driver-availability.gateway';
import {
  AvailabilitySnapshot,
  StatusUpdatedEvent,
  LocationUpdatedEvent,
  TripUpdatedEvent,
} from 'src/core/domain/events/driver-availability.events';
import { AdminGateway } from '../gateways/admin.gateway';

@Injectable()
export class DriverAvailabilityRealtimePublisher {
  private readonly logger = new Logger(
    DriverAvailabilityRealtimePublisher.name,
  );
  constructor(
    private readonly gateway: DriverAvailabilityGateway,
    private readonly adminGateway: AdminGateway,
  ) {}

  statusUpdated(ev: StatusUpdatedEvent) {
    const d = ev.snapshot.driverId;
    // emitir a ese driver (app), y a admin/dispatch (broadcast):
    this.gateway.server
      ?.to(`driver:${d}`)
      .emit('driver:availability:update', ev.snapshot);
    this.adminGateway.server?.emit(
      'admin:driver:availability:update',
      ev.snapshot,
    );
  }

  locationUpdated(ev: LocationUpdatedEvent) {
    const d = ev.snapshot.driverId;
    this.gateway.server?.to(`driver:${d}`).emit('driver:location:update', {
      driverId: d,
      coords: ev.snapshot.lastLocation ?? null,
      timestamp: ev.snapshot.lastLocationTimestamp ?? ev.at,
    });
    this.gateway.server?.emit('admin:driver:location:update', ev.snapshot);
  }

  tripUpdated(ev: TripUpdatedEvent) {
    const d = ev.snapshot.driverId;
    this.gateway.server?.to(`driver:${d}`).emit('driver:trip:update', {
      driverId: d,
      currentTripId: ev.snapshot.currentTripId,
    });
    this.gateway.server?.emit('admin:driver:trip:update', ev.snapshot);
  }
}
