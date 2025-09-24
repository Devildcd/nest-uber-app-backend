import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class TripAuditLogger {
  private readonly logger = new Logger(TripAuditLogger.name);

  @OnEvent('trip.*', { async: true })
  async onAnyTripEvent(payload: any, eventName: string) {
    this.logger.debug(`AUDIT ${eventName} -> ${JSON.stringify(payload)}`);
  }
}
