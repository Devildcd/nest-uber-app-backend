import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TripRequestedEvent } from '../../events/trip-requested.event';

@Injectable()
export class TripWsNotifier {
  private readonly logger = new Logger(TripWsNotifier.name);

  @OnEvent('trip.requested', { async: true })
  async onTripRequested(evt: TripRequestedEvent) {
    // TODO: emitir a room passenger:{evt.passengerId}
    this.logger.log(`WS notify: trip.requested ${evt.tripId}`);
  }
}
