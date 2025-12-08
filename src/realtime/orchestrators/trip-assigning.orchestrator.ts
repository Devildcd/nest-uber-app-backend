import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TripService } from 'src/modules/trip/services/trip.service';
import {
  TripDomainEvents,
  TripRequestedEvent,
} from 'src/core/domain/events/trip-domain.events';

@Injectable()
export class TripAssigningOrchestrator {
  private readonly logger = new Logger(TripAssigningOrchestrator.name);

  constructor(private readonly tripService: TripService) {
    this.logger.log('TripAssigningOrchestrator initialised');
  }

  /**
   * En cuanto se solicita el trip ⇒ iniciamos ASSIGNING de manera automática.
   * Usa defaults razonables; puedes moverlos a config.
   */
  @OnEvent(TripDomainEvents.TripRequested, { async: true })
  async onTripRequestedAutoAssign(ev: TripRequestedEvent) {
    const { tripId } = ev.snapshot;
    try {
      await this.tripService.startAssigning(tripId, {
        searchRadiusMeters: 3000,
        maxCandidates: 5,
        offerTtlSeconds: 20,
      });

      this.logger.debug(
        `Auto-assigning started for trip=${tripId} (from TripRequested)`,
      );
    } catch (err: any) {
      // Si ya inició/avanzó, lo tratamos como camino feliz idempotente
      if (
        err instanceof ConflictException ||
        /must be 'pending' to start assigning/i.test(String(err?.message))
      ) {
        this.logger.verbose(
          `Trip ${tripId} not in 'pending' when auto-assigning (likely already handled).`,
        );
        return;
      }
      if (err instanceof NotFoundException) {
        this.logger.warn(`Trip ${tripId} not found when auto-assigning.`);
        return;
      }
      this.logger.error(
        `Auto-assigning failed for trip=${tripId}: ${String(err?.message)}`,
      );
    }
  }
}
