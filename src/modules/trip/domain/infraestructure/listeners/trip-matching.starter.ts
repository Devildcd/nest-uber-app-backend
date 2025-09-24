import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TripRequestedEvent } from '../../events/trip-requested.event';

@Injectable()
export class TripMatchingStarter {
  private readonly logger = new Logger(TripMatchingStarter.name);

  @OnEvent('trip.requested', { async: true })
  async onTripRequested(evt: TripRequestedEvent) {
    // TODO: encolar “find-driver” (ahora stub)
    this.logger.log(`Enqueue matching for trip ${evt.tripId}`);
  }
}
