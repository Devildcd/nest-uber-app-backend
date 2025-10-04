import {
  ConflictException,
  Injectable,
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

@Injectable()
export class TripHelpersService {
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
    // const vtPerMin = Number(                                        // ⛔ minuto
    //   (trip as any).estimateVehicleType?.costPerMinute ?? vt?.costPerMinute ?? 0,
    // );
    const vtMin = Number(
      (trip as any).estimateVehicleType?.minFare ?? vt?.minFare ?? 0,
    );

    const mulBase = Number(sc?.baseFareMultiplier ?? 1);
    const mulKm = Number(sc?.costPerKmMultiplier ?? 1);
    // const mulMin = Number(sc?.costPerMinuteMultiplier ?? 1);         // ⛔ minuto
    const mulMF = Number(sc?.minFareMultiplier ?? 1);

    const base = vtBase * mulBase;
    const perKm = vtPerKm * mulKm;
    // const perMin = vtPerMin * mulMin;                                // ⛔ minuto
    const minFare = vtMin * mulMF;

    const surge = Number(trip.fareSurgeMultiplier ?? 1.0);
    const extras = Number(extraFees ?? 0);

    const distanceKm = r3(Math.max(0, actualDistanceKm));
    const durationMin = r2(Math.max(0, actualDurationMin)); // se reporta, pero NO suma

    // const subtotal = base + perKm * distanceKm + perMin * durationMin + extras; // ⛔ antes
    const subtotal = base + perKm * distanceKm + extras; // ✅ solo km
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
      // cost_per_minute: r4(perMin), // ⛔ desactivado (minuto)
      cost_per_minute: 0, // ✅ mostrado pero sin efecto
      min_fare: r2(minFare),

      applied_multipliers: {
        base: mulBase,
        per_km: mulKm,
        // per_min: mulMin, // ⛔ desactivado (minuto)
        per_min: 1, // ✅ neutralizado
        min_fare: mulMF,
      },

      // Para trazabilidad seguimos exponiendo las “est” con los reales
      distance_km_est: distanceKm,
      duration_min_est: durationMin,

      subtotal: r2(subtotal),
      total: r2(totalBase),
      surge_multiplier: surge,
    };

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
   * 2) CASCARÓN del algoritmo + 3) creación de oferta.
   * - NO implementa el filtrado real. Solo muestra el flujo.
   * - Usa tu tripRepo.buildPriorityQueueForTrip(...) para el orden.
   * - Crea exactamente UNA oferta (la del mejor candidato).
   */
  async runMatchingOnce(
    tripId: string,
    dto: StartAssigningDto,
  ): Promise<{ assignmentId?: string; message: string }> {
    const radius = dto.searchRadiusMeters ?? 3000;
    const limit = dto.maxCandidates ?? 5;
    const ttlSec = dto.offerTtlSeconds ?? 20;

    // 1) Trip y estado
    const trip = await this.tripRepo.findById(tripId, {
      relations: {
        requestedVehicleCategory: true,
        requestedServiceClass: true,
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.currentStatus !== TripStatus.ASSIGNING) {
      throw new ConflictException('Trip must be in "assigning" state');
    }

    // (opcional) short-circuit: si ya hay una oferta activa, no generes otra
    const existingOffers = await this.tripAssignmentsRepo.listOfferedByTrip(
      trip.id,
    );
    if (existingOffers.length > 0) {
      return {
        assignmentId: existingOffers[0].id,
        message: 'Active offer already exists',
      };
    }

    // 2) Prefiltrado desde drivers_availability (LECTURA, sin lock)
    const pickup = this.extractPickupLatLng(trip);
    const rawCandidates = await this.availabilityRepo.findEligibleDrivers({
      pickup,
      radiusMeters: radius,
      vehicleCategoryId: trip.requestedVehicleCategory?.id ?? null,
      serviceClassId: trip.requestedServiceClass?.id ?? null,
      excludeAlreadyTriedForTripId: trip.id,
      // puedes hacer overfetch dentro del repo; aquí pedimos exactamente 'limit'
      limit,
      requireWalletActive: true,
      requireVehicleInService: true,
      ttlSeconds: 90,
    });

    const prefiltered = rawCandidates.map((c) => ({
      driverId: c.driverId,
      vehicleId: c.primaryVehicleId,
    }));

    // 3) Ordenar por tu cola de prioridad
    const ordered = await this.tripRepo.buildPriorityQueueForTrip(
      trip.id,
      pickup,
      prefiltered,
    );
    if (!ordered.length) {
      return { message: 'No candidates found for this round' };
    }

    // 4) Intentos con mini-TX y revalidación por candidato
    for (const cand of ordered) {
      try {
        const assignment = await withQueryRunnerTx(
          this.dataSource,
          async (_qr, manager) => {
            // 4.1) Releer y lockear trip (por si cambió)
            const tLocked = await this.tripRepo.lockByIdForUpdate(
              trip.id,
              manager,
            );
            if (!tLocked) throw new NotFoundException();
            if (tLocked.currentStatus !== TripStatus.ASSIGNING) {
              throw new ConflictException('Trip left "assigning" state');
            }

            // 4.2) Fallo rápido: asegurar unicidad de oferta activa de este trip
            await this.tripAssignmentsRepo.ensureNoActiveOfferForTrip(
              tLocked.id,
              manager,
            );

            // 4.3) Lock del driver (estado canónico de disponibilidad)
            const dLocked = await this.availabilityRepo.lockDriverForUpdate(
              cand.driverId,
              manager,
            );
            if (!dLocked) {
              throw new ConflictException(
                'Driver no longer available (missing row)',
              );
            }

            // 4.4) Re-validaciones críticas bajo lock
            this.matchingDomainGuards.ensureDriverEligibleForTrip({
              trip: tLocked,
              driverAvailability: dLocked,
              vehicleId: cand.vehicleId,
              pickup,
              radiusMeters: radius,
            });

            // 4.5) Crear oferta (now/ttl dentro de la TX)
            const now = new Date();
            const ttl = new Date(now.getTime() + ttlSec * 1000);

            const a = await this.tripAssignmentsRepo.createOffered(
              tLocked.id,
              cand.driverId,
              cand.vehicleId,
              ttl,
              manager,
              { radius_m: radius },
            );

            // 4.6) Evento
            await this.tripEventsRepo.append(
              tLocked.id,
              TripEventType.DRIVER_OFFERED as any,
              now,
              {
                assignment_id: a.id,
                driver_id: cand.driverId,
                vehicle_id: cand.vehicleId,
                ttl_expires_at: ttl.toISOString(),
              },
              manager,
            );

            return a;
          },
          { logLabel: 'trip.match.offer' },
        );

        this.events.emit(TripDomainEvents.DriverOffered, {
          at: new Date().toISOString(),
          tripId: trip.id,
          assignmentId: assignment.id,
          driverId: assignment.driver.id ?? cand.driverId, // por si necesitas fallback
          vehicleId: assignment.vehicle.id ?? cand.vehicleId, // idem
          ttlExpiresAt: assignment.ttlExpiresAt!.toISOString(),
        } as DriverOfferedEvent);

        // Éxito en el primer candidato que pasa
        // TODO: notificar via WS al driver con countdown (ttlSec)
        return { assignmentId: assignment.id, message: 'Offer created' };
      } catch (err: any) {
        // Si chocamos con el índice único (carrera), o falla la revalidación, probamos con el siguiente
        // PG unique_violation
        if (
          err?.code === '23505' ||
          String(err?.message).includes('ACTIVE_OFFER_ALREADY_EXISTS_FOR_TRIP')
        ) {
          // alguien creó la oferta en paralelo; devolvemos estado consistente
          const active = await this.tripAssignmentsRepo.listOfferedByTrip(
            trip.id,
          );
          if (active.length) {
            return {
              assignmentId: active[0].id,
              message: 'Active offer already exists',
            };
          }
        }
        // continuar con el siguiente candidato
        continue;
      }
    }

    // Si ninguno pasó la revalidación
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
