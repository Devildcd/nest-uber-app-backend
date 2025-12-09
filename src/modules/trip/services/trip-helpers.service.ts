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
import { FareBreakdown } from '../interfaces/trip.interfaces';
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
  ) {}

  /**
   * Calcula un estimado con:
   * - vehicle_types (base_fare, cost_per_km, cost_per_minute, min_fare)
   * - vehicle_service_classes (multipliers)
   * - distancia Haversine pickup -> stops encadenados
   * - duración aprox: (dist_km / 30 km/h) * 60
   *
   * TODO: integrar pricing_settings (city/zone/global), booking_fee, surge dinámico, etc.
   */
  // SOLO-KM PRICING — el minuto queda comentado y no afecta el precio
  async estimateForRequest(params: {
    vehicleCategoryId: string;
    serviceClassId: string;
    pickup: Point; // GeoJSON [lng, lat]
    stops: Point[]; // GeoJSON [lng, lat] (el último es el destino)
    currency?: string;
    manager?: EntityManager;
  }): Promise<{
    currency: string;
    surgeMultiplier: number;
    totalEstimated: number;
    breakdown: FareBreakdown;
  }> {
    const m = params.manager ?? this.dataSource.manager;
    const currency = params.currency ?? 'USD';

    // 1) VehicleType elegible para (category, service class)
    const vt = await m
      .getRepository(VehicleType)
      .createQueryBuilder('vt')
      .innerJoin('vt.serviceClasses', 'sc', 'sc.id = :scId', {
        scId: params.serviceClassId,
      })
      .leftJoinAndSelect('vt.category', 'cat')
      .where('cat.id = :catId', { catId: params.vehicleCategoryId })
      .andWhere('vt.isActive = true')
      .orderBy('vt.baseFare', 'ASC')
      .getOne();

    // 2) Service class (multipliers)
    const scEntity = await m.getRepository(VehicleServiceClass).findOne({
      where: { id: params.serviceClassId },
    });

    if (!vt || !scEntity) {
      const breakdown: FareBreakdown = {
        vehicle_type_name: vt?.name ?? '(unknown)',
        service_class_name: scEntity?.name ?? '(unknown)',
        category_name: vt?.category?.name ?? '(unknown)',
        vehicle_type_id: vt?.id,
        service_class_id: scEntity?.id,
        category_id: vt?.category?.id ?? params.vehicleCategoryId,

        base_fare: 0,
        cost_per_km: 0,
        cost_per_minute: 0, // ← minuto presente pero sin efecto
        min_fare: 0,

        applied_multipliers: { base: 1, per_km: 1, per_min: 1, min_fare: 1 },
        distance_km_est: 0,
        duration_min_est: 0,
        subtotal: 0,
        total: 0,
        surge_multiplier: 1,
      };

      return { currency, surgeMultiplier: 1, totalEstimated: 0, breakdown };
    }

    // 3) Multiplicadores y tarifas base
    const vtBase = Number(vt.baseFare);
    const vtPerKm = Number(vt.costPerKm);
    // const vtPerMin = Number(vt.costPerMinute);            // ⛔ desactivado (minuto)
    const vtMinFare = Number(vt.minFare);

    const mulBase = Number(scEntity.baseFareMultiplier);
    const mulKm = Number(scEntity.costPerKmMultiplier);
    // const mulMin = Number(scEntity.costPerMinuteMultiplier); // ⛔ desactivado (minuto)
    const mulMinFare = Number(scEntity.minFareMultiplier);

    const base = vtBase * mulBase;
    const perKm = vtPerKm * mulKm;
    // const perMin = vtPerMin * mulMin;                     // ⛔ desactivado (minuto)
    const minFare = vtMinFare * mulMinFare;

    // 4) Distancia/tiempo estimados
    const allPoints: Point[] = [params.pickup, ...(params.stops ?? [])];
    const distKm = this.chainHaversineKm(allPoints);
    const durMin = (distKm / 30) * 60; // seguimos calculándolo, pero NO afecta precio

    // 5) Subtotal y surge (minutos fuera del cálculo)
    const surge = 1.0;
    // const subtotal = base + perKm * distKm + perMin * durMin; // ⛔ antes
    const subtotal = base + perKm * distKm; // ✅ solo km
    const totalBase = Math.max(subtotal, minFare);
    const total = totalBase * surge;

    const round2 = (n: number) => Number(n.toFixed(2));
    const round3 = (n: number) => Number(n.toFixed(3));
    const round4 = (n: number) => Number(n.toFixed(4));

    const breakdown: FareBreakdown = {
      vehicle_type_name: vt.name,
      service_class_name: scEntity.name,
      category_name: vt.category?.name ?? '(unknown)',

      vehicle_type_id: vt.id,
      service_class_id: scEntity.id,
      category_id: vt.category?.id,

      base_fare: round2(base),
      cost_per_km: round4(perKm),
      // cost_per_minute: round4(perMin), // ⛔ desactivado (minuto)
      cost_per_minute: 0, // ✅ mostrado pero sin efecto
      min_fare: round2(minFare),

      applied_multipliers: {
        base: mulBase,
        per_km: mulKm,
        // per_min: mulMin, // ⛔ desactivado (minuto)
        per_min: 1, // ✅ neutralizado
        min_fare: mulMinFare,
      },

      distance_km_est: round3(distKm),
      duration_min_est: round2(durMin),
      subtotal: round2(subtotal),
      total: round2(totalBase),
      surge_multiplier: surge,
    };

    return {
      currency,
      surgeMultiplier: surge,
      totalEstimated: round2(total),
      breakdown,
    };
  }

  /**
   * Recalcula totales al cierre usando distancia/tiempo reales.
   * - Conserva el surge guardado en el trip.
   * - Usa VT/SC del snapshot (o infiere compatibles).
   */
  /**
   * Recalcula totales al cierre usando distancia/tiempo reales.
   * SOLO-KM PRICING — el minuto queda comentado y NO afecta el precio final.
   */
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
  ): Promise<{
    distanceKm: number;
    durationMin: number;
    surgeMultiplier: number;
    fareTotal: number;
    currency: string;
    breakdown: FareBreakdown;
  }> {
    const m = manager ?? this.dataSource.manager;

    const sc =
      trip.requestedServiceClass ??
      (await m.getRepository(VehicleServiceClass).findOne({
        where: {
          id:
            (trip as any).requestedServiceClass?.id ??
            (trip as any).requestedServiceClassId,
        },
      }));

    let vt =
      trip.estimateVehicleType ??
      (await m.getRepository(VehicleType).findOne({
        where: {
          id:
            (trip as any).estimateVehicleType?.id ??
            (trip as any).estimateVehicleTypeId,
        },
        relations: { category: true },
      }));

    if (!vt && sc) {
      vt = await m
        .getRepository(VehicleType)
        .createQueryBuilder('vt')
        .innerJoin('vt.serviceClasses', 'sc', 'sc.id = :scId', { scId: sc.id })
        .where('vt.isActive = true')
        .orderBy('vt.baseFare', 'ASC')
        .getOne();
    }

    const vtBase = Number(
      (trip as any).estimateVehicleType?.baseFare ?? vt?.baseFare ?? 0,
    );
    const vtPerKm = Number(
      (trip as any).estimateVehicleType?.costPerKm ?? vt?.costPerKm ?? 0,
    );
    const vtMin = Number(
      (trip as any).estimateVehicleType?.minFare ?? vt?.minFare ?? 0,
    );

    const mulBase = Number(sc?.baseFareMultiplier ?? 1);
    const mulKm = Number(sc?.costPerKmMultiplier ?? 1);
    const mulMF = Number(sc?.minFareMultiplier ?? 1);

    const base = vtBase * mulBase;
    const perKm = vtPerKm * mulKm;
    const minFare = vtMin * mulMF;

    const surge = Number(trip.fareSurgeMultiplier ?? 1.0);
    const extras = Number(extraFees ?? 0);

    const distanceKm = r3(Math.max(0, actualDistanceKm));
    const durationMin = r2(Math.max(0, actualDurationMin)); // solo reporting

    // 👇 extras suman solo en subtotal
    const subtotal = base + perKm * distanceKm + extras;
    const totalBase = Math.max(subtotal, minFare);
    const fareTotal = r2(totalBase * surge);

    const currency = trip.fareFinalCurrency ?? 'USD';

    const breakdown: FareBreakdown = {
      vehicle_type_name:
        (trip as any).estimateVehicleType?.name ?? vt?.name ?? '(unknown)',
      service_class_name: sc?.name ?? '(unknown)',
      category_name:
        (trip as any).estimateVehicleType?.category?.name ??
        vt?.category?.name ??
        '(unknown)',
      vehicle_type_id: (trip as any).estimateVehicleType?.id ?? vt?.id,
      service_class_id: sc?.id,
      category_id:
        (trip as any).estimateVehicleType?.category?.id ?? vt?.category?.id,

      base_fare: r2(base),
      cost_per_km: r4(perKm),
      cost_per_minute: 0, // minuto neutralizado
      min_fare: r2(minFare),

      applied_multipliers: {
        base: mulBase,
        per_km: mulKm,
        per_min: 1, // minuto neutralizado
        min_fare: mulMF,
      },

      distance_km_est: distanceKm,
      duration_min_est: durationMin,

      subtotal: r2(subtotal),
      total: r2(totalBase),
      surge_multiplier: surge,
    };

    // 👇 Enriquecemos con info de espera / penalización
    if (opts?.waitingTimeMinutes != null) {
      breakdown.waiting_time_minutes = r2(opts.waitingTimeMinutes);
    }
    if (opts?.waitingReason) {
      breakdown.waiting_reason = opts.waitingReason;
    }
    if (extras > 0) {
      breakdown.extra_fees_total = r2(extras);
      breakdown.extra_lines = [
        {
          code: 'wait_penalty',
          label: opts?.waitingReason ?? 'Recargo por espera',
          amount: r2(extras),
          meta: {
            waiting_minutes: breakdown.waiting_time_minutes ?? null,
          },
        },
      ];
    }

    return {
      distanceKm,
      durationMin,
      fareTotal,
      surgeMultiplier: surge,
      currency,
      breakdown,
    };
  }

  /** Distancia acumulada Haversine en km */
  private chainHaversineKm(points: Point[]): number {
    if (!points || points.length < 2) return 0;
    let acc = 0;
    for (let i = 0; i < points.length - 1; i++) {
      acc += this.haversineKm(points[i], points[i + 1]);
    }
    return acc;
  }

  private haversineKm(a: Point, b: Point): number {
    const R = 6371; // km
    const [lng1, lat1] = a.coordinates as [number, number];
    const [lng2, lat2] = b.coordinates as [number, number];
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  private toRad(deg: number) {
    return (deg * Math.PI) / 180;
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
