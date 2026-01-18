import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Point } from 'geojson';
import { VehicleServiceClass } from 'src/modules/vehicle-service-classes/entities/vehicle-service-classes.entity';
import { VehicleType } from 'src/modules/vehicle-types/entities/vehicle-types.entity';
import { DataSource, EntityManager } from 'typeorm';
import { StartAssigningDto } from '../dtos/trip-assignment/start-assigning.dto';
import { TripRepository } from '../repositories/trip.repository';
import { Trip, TripStatus } from '../entities/trip.entity';
import { TripEventsRepository } from '../repositories/trip-events.repository';
import { TripEventType } from '../interfaces/trip-event-types.enum';
import { TripAssignmentRepository } from '../repositories/trip-assignment.repository';
import { withQueryRunnerTx } from 'src/common/utils/tx.util';
import { DriverAvailabilityRepository } from 'src/modules/drivers-availability/repositories/driver-availability.repository';
import { MatchingDomainGuards } from '../domain/matching-domain-guards';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DriverOfferedEvent,
  TripDomainEvents,
} from 'src/core/domain/events/trip-domain.events';
import { PricingEngineService } from 'src/modules/settings/price-policies/services/pricing-engine.service';
import { FareBreakdown } from 'src/common/interfaces/fare-breakdown.interface';

const r2 = (n: number) => Number(Number(n).toFixed(2));
const r3 = (n: number) => Number(Number(n).toFixed(3));
const r4 = (n: number) => Number(Number(n).toFixed(4));

type TimerKey = string;

@Injectable()
export class TripHelpersService {
  private readonly logger = new Logger(TripHelpersService.name);
  private timers = new Map<TimerKey, NodeJS.Timeout>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly tripRepo: TripRepository,
    private readonly tripEventsRepo: TripEventsRepository,
    private readonly tripAssignmentsRepo: TripAssignmentRepository,
    private readonly availabilityRepo: DriverAvailabilityRepository,
    private readonly matchingDomainGuards: MatchingDomainGuards,
    private readonly events: EventEmitter2,
    private readonly pricing: PricingEngineService,
  ) {}

  async estimateForRequest(params: {
    vehicleCategoryId: string;
    serviceClassId: string;
    pickup: Point;
    stops: Point[];
    currency?: string;
    manager?: EntityManager;
    cityId?: string | null;
    at?: Date;
  }): Promise<{
    currency: string;
    surgeMultiplier: number;
    totalEstimated: number;
    breakdown: FareBreakdown;
  }> {
    return this.pricing.estimateForRequest(params);
  }

  async computeFinalForCompletion(
    trip: Trip,
    actualDistanceKm: number,
    actualDurationMin: number,
    extraFees: number | null | undefined,
    opts?: {
      waitingTimeMinutes?: number | null;
      waitingReason?: string | null;
    },
    manager?: EntityManager,
  ) {
    return this.pricing.computeFinalForCompletion(
      trip,
      actualDistanceKm,
      actualDurationMin,
      extraFees,
      opts,
      manager,
    );
  }

  /**
   * Matching simplificado:
   * - Busca conductores elegibles en un radio (default 5km).
   * - Si hay ofertas activas, no crea otra.
   * - Elige **uno al azar** entre los elegibles y crea la oferta (con locks).
   * - Emite DriverOffered al final.
   */
  async runMatchingOnce(tripId: string, dto: StartAssigningDto) {
    const radius = dto.searchRadiusMeters ?? 5000;
    const limit = dto.maxCandidates ?? 10;
    const ttlSec = dto.offerTtlSeconds ?? 20;

    this.logger.debug(
      `matching: start trip=${tripId} r=${radius}m limit=${limit} ttl=${ttlSec}`,
    );

    const trip = await this.tripRepo.findById(tripId, {
      relations: {
        requestedVehicleCategory: true,
        requestedServiceClass: true,
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.currentStatus !== TripStatus.ASSIGNING) {
      this.logger.warn(
        `matching: trip not in ASSIGNING (current=${trip.currentStatus}) trip=${tripId}`,
      );
      throw new ConflictException('Trip must be in "assigning" state');
    }

    const existing = await this.tripAssignmentsRepo.listOfferedByTrip(trip.id);
    if (existing.length > 0) {
      this.logger.debug(
        `matching: active offer exists trip=${tripId} assignment=${existing[0].id}`,
      );
      return {
        assignmentId: existing[0].id,
        message: 'Active offer already exists',
      };
    }

    const pickup = this.extractPickupLatLng(trip);
    this.logger.debug(
      `matching: pickup extracted lat=${pickup.lat} lng=${pickup.lng} (should match request)`,
    );

    let rawCandidates: Array<{ driverId: string; primaryVehicleId: string }> =
      [];
    try {
      this.logger.debug(
        `matching: eligibles params radius=${radius}m limit=${limit} cat=${trip.requestedVehicleCategory?.id ?? 'null'} svc=${trip.requestedServiceClass?.id ?? 'null'} ttl=${90}s wallet=${true} inService=${true}`,
      );
      rawCandidates = await this.availabilityRepo.findEligibleDrivers({
        pickup,
        radiusMeters: radius,
        vehicleCategoryId: trip.requestedVehicleCategory?.id ?? null,
        serviceClassId: trip.requestedServiceClass?.id ?? null,
        excludeAlreadyTriedForTripId: trip.id,
        limit,
        requireWalletActive: true,
        requireVehicleInService: true,
        ttlSeconds: 90,
      });
    } catch (e: any) {
      this.logger.error(
        `matching: availability query failed trip=${tripId}: ${e?.message}`,
      );
      // Propaga para que el caller marque NDF si corresponde
      throw e;
    }

    this.logger.debug(
      `matching: ${rawCandidates.length} candidates found trip=${tripId}`,
    );

    if (!rawCandidates.length) {
      return { message: 'No candidates found within radius' };
    }

    // Random shuffle
    const shuffled = [...rawCandidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    this.logger.debug(
      `matching: shuffled order size=${shuffled.length} trip=${tripId}`,
    );

    for (const cand of shuffled) {
      try {
        const assignment = await withQueryRunnerTx(
          this.dataSource,
          async (_qr, manager) => {
            const tLocked = await this.tripRepo.lockByIdForUpdate(
              trip.id,
              manager,
            );
            if (!tLocked) throw new NotFoundException();
            if (tLocked.currentStatus !== TripStatus.ASSIGNING) {
              throw new ConflictException('Trip left "assigning" state');
            }
            await this.tripAssignmentsRepo.ensureNoActiveOfferForTrip(
              tLocked.id,
              manager,
            );
            const dLocked = await this.availabilityRepo.lockDriverForUpdate(
              cand.driverId,
              manager,
            );
            if (!dLocked)
              throw new ConflictException(
                'Driver no longer available (missing row)',
              );

            this.matchingDomainGuards.ensureDriverEligibleForTrip({
              trip: tLocked,
              driverAvailability: dLocked,
              vehicleId: cand.primaryVehicleId,
              pickup,
              radiusMeters: radius,
            });

            const now = new Date();
            const ttl = new Date(now.getTime() + ttlSec * 1000);

            const a = await this.tripAssignmentsRepo.createOffered(
              tLocked.id,
              cand.driverId,
              cand.primaryVehicleId,
              ttl,
              manager,
              { radius_m: radius },
            );

            await this.tripEventsRepo.append(
              tLocked.id,
              TripEventType.DRIVER_OFFERED as any,
              now,
              {
                assignment_id: a.id,
                driver_id: cand.driverId,
                vehicle_id: cand.primaryVehicleId,
                ttl_expires_at: ttl.toISOString(),
              },
              manager,
            );

            return a;
          },
          { logLabel: 'trip.match.offer' },
        );

        this.logger.log(
          `matching: offer created trip=${trip.id} assignment=${assignment.id} driver=${cand.driverId}`,
        );

        this.events.emit(TripDomainEvents.DriverOffered, {
          at: new Date().toISOString(),
          tripId: trip.id,
          assignmentId: assignment.id,
          driverId: assignment.driver.id ?? cand.driverId,
          vehicleId: assignment.vehicle.id ?? cand.primaryVehicleId,
          ttlExpiresAt: assignment.ttlExpiresAt!.toISOString(),
        } as DriverOfferedEvent);

        return { assignmentId: assignment.id, message: 'Offer created' };
      } catch (err: any) {
        this.logger.warn(
          `matching: candidate failed driver=${cand.driverId} reason=${err?.message ?? err}`,
        );
        if (
          err?.code === '23505' ||
          String(err?.message).includes('ACTIVE_OFFER_ALREADY_EXISTS_FOR_TRIP')
        ) {
          const active = await this.tripAssignmentsRepo.listOfferedByTrip(
            trip.id,
          );
          if (active.length) {
            this.logger.debug(
              `matching: race detected, returning existing assignment=${active[0].id}`,
            );
            return {
              assignmentId: active[0].id,
              message: 'Active offer already exists',
            };
          }
        }
        continue;
      }
    }

    this.logger.debug(
      `matching: no candidates passed revalidation trip=${tripId}`,
    );
    return { message: 'No candidates passed revalidation' };
  }

  // ----------------- helpers -----------------
  private extractPickupLatLng(trip: Trip): { lat: number; lng: number } {
    const coords = (trip as any).pickupPoint?.coordinates as
      | [number, number]
      | undefined;
    if (!coords) return { lat: 0, lng: 0 };
    const [lng, lat] = coords;
    return { lat, lng };
  }
}
