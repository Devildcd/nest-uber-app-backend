import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DriverAcceptedEvent,
  TripDomainEvents,
} from 'src/core/domain/events/trip-domain.events';
import { DriverLocationService } from 'src/modules/drivers-availability/services/driver-location.service';
import { TripStatus } from 'src/modules/trip/entities/trip.entity';
import { TripRepository } from 'src/modules/trip/repositories/trip.repository';
import { TripService } from 'src/modules/trip/services/trip.service';

export type DriverAcceptedAutoArrivingPayload = DriverAcceptedEvent;

@Injectable()
export class DriverAssignedAutoArrivingOrchestrator {
  private readonly logger = new Logger(
    DriverAssignedAutoArrivingOrchestrator.name,
  );

  constructor(
    private readonly tripRepo: TripRepository,
    private readonly driverEta: DriverLocationService,
    // @Inject(forwardRef(() => TripService))
    private readonly tripService: TripService,
  ) {}

  @OnEvent(TripDomainEvents.DriverAccepted, { async: true })
  async onDriverAccepted(ev: DriverAcceptedAutoArrivingPayload) {
    const { tripId, driverId, assignmentId } = ev;

    this.logger.log(
      `[AUTO] onDriverAccepted recibido trip=${tripId} driver=${driverId} assignment=${assignmentId}`,
    );

    try {
      // 1) Trip mínimo, sin relaciones pesadas
      const t = await this.tripRepo.findById(tripId, {
        relations: { passenger: false, driver: false, vehicle: false } as any,
      });
      if (!t) {
        this.logger.error(`[AUTO] trip no encontrado trip=${tripId}`);
        throw new NotFoundException('Trip not found');
      }

      this.logger.debug(
        `[AUTO] estado actual trip=${tripId} status=${t.currentStatus}`,
      );

      // Idempotencia: solo disparamos si sigue en ACCEPTED
      if (t.currentStatus !== TripStatus.ACCEPTED) {
        this.logger.warn(
          `[AUTO] skip auto-arriving: trip=${tripId} status=${t.currentStatus} (esperado=${TripStatus.ACCEPTED})`,
        );
        return;
      }

      if (!t.pickupPoint?.coordinates?.length) {
        this.logger.warn(
          `[AUTO] trip=${tripId} sin pickupPoint, skip auto-arriving`,
        );
        return;
      }

      const pickup = {
        lat: t.pickupPoint.coordinates[1],
        lng: t.pickupPoint.coordinates[0],
      };

      this.logger.debug(
        `[AUTO] calculando ETA driver=${driverId} -> pickup=(${pickup.lat},${pickup.lng})`,
      );

      // 2) ETA desde la última ubicación conocida del driver
      const { etaMinutes, driverPosition } = await this.driverEta.estimateTo(
        driverId,
        pickup,
      );

      this.logger.debug(
        `[AUTO] ETA calculada trip=${tripId} driver=${driverId} etaMinutes=${
          etaMinutes ?? 'null'
        } position=${driverPosition ? JSON.stringify(driverPosition) : 'null'}`,
      );

      // 3) Transición ACCEPTED -> ARRIVING vía servicio de dominio
      this.logger.log(
        `[AUTO] llamando a startArriving trip=${tripId} driver=${driverId}`,
      );

      await this.tripService.startArriving(tripId, {
        driverId,
        etaMinutes: etaMinutes ?? undefined,
        driverLat: driverPosition?.lat ?? undefined,
        driverLng: driverPosition?.lng ?? undefined,
      });

      this.logger.log(
        `[AUTO] auto-arriving OK trip=${tripId} driver=${driverId} eta=${etaMinutes ?? 'null'}min`,
      );
    } catch (err) {
      if (err instanceof ConflictException) {
        this.logger.warn(
          `[AUTO] auto-arriving conflict trip=${tripId}: ${err.message}`,
        );
        return;
      }
      this.logger.error(
        `[AUTO] auto-arriving failed trip=${tripId}: ${(err as Error).message}`,
      );
    }
  }
}
