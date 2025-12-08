import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AssignmentExpiredEvent,
  DriverAcceptedEvent,
  DriverOfferedEvent,
  TripDomainEvents,
} from 'src/core/domain/events/trip-domain.events';
import { AssignmentExpiryScheduler } from 'src/modules/trip/services/assignment-expiry.scheduler';

@Injectable()
export class AssignmentExpiryListener {
  private readonly logger = new Logger(AssignmentExpiryListener.name);
  constructor(private readonly scheduler: AssignmentExpiryScheduler) {
    this.logger.log('AssignmentExpiryScheduler initialised');
  }

  @OnEvent(TripDomainEvents.DriverOffered, { async: true })
  onDriverOffered(ev: DriverOfferedEvent) {
    this.logger.debug(
      `DriverOffered trip=${ev.tripId} assignment=${ev.assignmentId} ttl=${ev.ttlExpiresAt}`,
    );
    // programa expiración
    this.scheduler.schedule(ev.assignmentId, ev.ttlExpiresAt);
  }

  // cualquier resolución de la oferta → limpia
  @OnEvent(TripDomainEvents.DriverAccepted, { async: true })
  onAccepted(ev: DriverAcceptedEvent) {
    this.scheduler.cancel(ev.assignmentId);
  }

  //   @OnEvent(TripDomainEvents.DriverRejected, { async: true })
  //   onRejected(ev: DriverRejectedEvent) {
  //     this.scheduler.cancel(ev.assignmentId);
  //   }

  @OnEvent(TripDomainEvents.AssignmentExpired, { async: true })
  onExpired(ev: AssignmentExpiredEvent) {
    this.scheduler.cancel(ev.assignmentId);
  }
}
