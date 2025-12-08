import { Injectable, Logger } from '@nestjs/common';
import { TripService } from './trip.service';

@Injectable()
export class AssignmentExpiryScheduler {
  private readonly logger = new Logger(AssignmentExpiryScheduler.name);
  private timers = new Map<string, NodeJS.Timeout>(); // key = assignmentId

  constructor(private readonly tripService: TripService) {
    this.logger.log('AssignmentExpiryScheduler initialised');
  }

  schedule(assignmentId: string, expiresAtIso: string) {
    // evita duplicado
    this.cancel(assignmentId);

    const delayMs = Math.max(0, Date.parse(expiresAtIso) - Date.now());
    this.logger.debug(
      `schedule expiry assignment=${assignmentId} in ${Math.round(delayMs / 1000)}s`,
    );

    const t = setTimeout(async () => {
      this.timers.delete(assignmentId);
      try {
        this.logger.log(`timer fired -> expire assignment=${assignmentId}`);
        await this.tripService.expireAssignment(assignmentId);
      } catch (e: any) {
        this.logger.error(
          `expireAssignment failed assignment=${assignmentId}: ${e?.message}`,
        );
      }
    }, delayMs);

    this.timers.set(assignmentId, t);
  }

  cancel(assignmentId: string) {
    const t = this.timers.get(assignmentId);
    if (t) {
      clearTimeout(t);
      this.timers.delete(assignmentId);
      this.logger.debug(`cancelled expiry timer assignment=${assignmentId}`);
    }
  }
}
