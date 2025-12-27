import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { VehicleServiceClass } from 'src/modules/vehicle-service-classes/entities/vehicle-service-classes.entity';
import { DataSource, EntityManager } from 'typeorm';
import { PricePolicyRepository } from '../repositories/price-policy.repository';
import { CityRepository } from '../../cities/repositories/city.repository';
import { ZoneRepository } from '../../zones/repositories/zone.repository';
import { Point } from 'geojson';
import { Trip } from 'src/modules/trip/entities/trip.entity';
import { VehicleType } from 'src/modules/vehicle-types/entities/vehicle-types.entity';
import {
  PricePolicy,
  PricePolicyConditions,
  PricePolicyPrice,
} from '../entities/price-policy.entity';
import {
  FareBreakdown,
  RateCard,
} from 'src/common/interfaces/fare-breakdown.interface';
import { AppliedMultipliers, Money } from '../interfaces/pricing.types';

const r2 = (n: number) => Number(Number(n).toFixed(2));
const r3 = (n: number) => Number(Number(n).toFixed(3));
const r4 = (n: number) => Number(Number(n).toFixed(4));

@Injectable()
export class PricingEngineService {
  private readonly logger = new Logger(PricingEngineService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly pricePolicyRepo: PricePolicyRepository,
    private readonly cityRepo: CityRepository,
    private readonly zoneRepo: ZoneRepository,
  ) {}

  /**
   * Estimate (request / quote)
   * VehicleType (rates) + ServiceClass (multipliers) + PricePolicy (factors/fees)
   */
  async estimateForRequest(params: {
    vehicleCategoryId: string;
    serviceClassId: string;
    pickup: Point;
    stops: Point[];
    currency?: string;
    at?: Date;
    manager?: EntityManager;
    cityId?: string | null;
  }): Promise<{
    currency: string;
    surgeMultiplier: number;
    totalEstimated: number;
    breakdown: FareBreakdown;
  }> {
    const m = params.manager ?? this.dataSource.manager;
    const at = params.at ?? new Date();
    const currency = params.currency ?? 'USD';

    // 1) Service class
    const sc = await m.getRepository(VehicleServiceClass).findOne({
      where: { id: params.serviceClassId },
    });
    if (!sc) throw new BadRequestException('Service class not found');

    // 2) VehicleType compatible (y category para labels)
    const vt = await this.findEligibleVehicleType(m, {
      vehicleCategoryId: params.vehicleCategoryId,
      serviceClassId: params.serviceClassId,
    });
    if (!vt)
      throw new BadRequestException('No eligible vehicle type for request');

    // 3) Distancia/tiempo estimados
    const allPoints = [params.pickup, ...(params.stops ?? [])];
    const distanceKm = r3(this.chainHaversineKm(allPoints));
    const durationMin = r2((distanceKm / 30) * 60);

    // 4) Contexto + policy
    const pickupLatLng = this.pointToLatLng(params.pickup);
    const { cityId, zoneId, cityTimezone } = await this.resolveContext(m, {
      pickup: pickupLatLng,
      cityIdHint: params.cityId ?? null,
    });

    const policy = await this.resolveApplicablePolicy(m, {
      at,
      cityId,
      zoneId,
      fallbackTimezone: cityTimezone,
    });

    const rateCard = this.buildRateCard(policy, cityTimezone);

    // 5) Multipliers (service class)
    const multipliers = this.extractMultipliers(sc);

    // 6) Vehicle rates (base real del cálculo)
    const vehicleRates = {
      baseFare: Number(vt.baseFare),
      perKm: Number(vt.costPerKm),
      perMinute: Number(vt.costPerMinute),
      minFare: Number(vt.minFare),
    };

    // 7) Calcular (surge por ahora fijo)
    const surge = 1.0;
    const computed = this.computeFare({
      vehicleRates,
      rateCard,
      multipliers,
      distanceKm,
      durationMin,
      surgeMultiplier: surge,
      extrasTotal: 0,
    });

    // 8) Breakdown (NO romper front)
    const breakdown: FareBreakdown = {
      // opcionales policy snapshot
      price_policy_id: rateCard.policyId,
      price_scope_type: rateCard.scopeType,
      timezone_used: rateCard.timezoneUsed,
      rate_card: rateCard,

      vehicle_type_name: vt.name,
      service_class_name: sc.name,
      category_name: vt.category?.name ?? '(unknown)',
      vehicle_type_id: vt.id,
      service_class_id: sc.id,
      category_id: vt.category?.id,

      base_fare: r2(computed.base),
      cost_per_km: r4(computed.perKm),
      cost_per_minute: r4(computed.perMin),
      min_fare: r2(computed.minFare),
      booking_fee: r2(computed.bookingFee),

      applied_multipliers: multipliers,

      distance_km_est: distanceKm,
      duration_min_est: durationMin,

      subtotal: r2(computed.subtotal),
      total: r2(computed.totalBase), // compat: total base (pre-surge)
      surge_multiplier: surge,
    };

    return {
      currency,
      surgeMultiplier: surge,
      totalEstimated: r2(computed.total), // total final (surge+cap+extras)
      breakdown,
    };
  }

  /**
   * Final fare (completion)
   * - Preferimos snapshot breakdown.rate_card
   * - Si no existe, resolvemos policy por contexto
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

    const distanceKm = r3(Math.max(0, actualDistanceKm));
    const durationMin = r2(Math.max(0, actualDurationMin));
    const currency = trip.fareFinalCurrency ?? 'USD';
    const surge = Number(trip.fareSurgeMultiplier ?? 1.0);
    const extrasTotal = r2(Math.max(0, Number(extraFees ?? 0)));

    // 1) Service class + multipliers
    const scId = trip.requestedServiceClass?.id ?? null;
    const sc = scId
      ? await m
          .getRepository(VehicleServiceClass)
          .findOne({ where: { id: scId } })
      : null;

    const multipliers = sc
      ? this.extractMultipliers(sc)
      : this.defaultMultipliers();

    // 2) VehicleType (idealmente snapshot del estimate)
    let vt: VehicleType | null = null;
    const vtId = trip.estimateVehicleType?.id ?? null;

    if (vtId) {
      vt = await m.getRepository(VehicleType).findOne({
        where: { id: vtId },
        relations: { category: true },
      });
    }

    // fallback: si por alguna razón no hay estimateVehicleType
    if (
      !vt &&
      trip.requestedVehicleCategory?.id &&
      trip.requestedServiceClass?.id
    ) {
      vt = await this.findEligibleVehicleType(m, {
        vehicleCategoryId: trip.requestedVehicleCategory.id,
        serviceClassId: trip.requestedServiceClass.id,
      });
    }

    if (!vt) {
      throw new BadRequestException(
        'Cannot compute final fare: missing vehicle type snapshot',
      );
    }

    const vehicleRates = {
      baseFare: Number(vt.baseFare),
      perKm: Number(vt.costPerKm),
      perMinute: Number(vt.costPerMinute),
      minFare: Number(vt.minFare),
    };

    // 3) RateCard: snapshot preferido
    const snapshot = trip.fareBreakdown ?? null;
    const rateCardFromSnapshot = this.tryGetRateCardFromBreakdown(snapshot);

    let rateCard: RateCard;
    if (rateCardFromSnapshot) {
      rateCard = rateCardFromSnapshot;
    } else {
      const pickupLatLng = this.pointToLatLng(
        trip.pickupPoint as unknown as Point,
      );
      const { cityId, zoneId, cityTimezone } = await this.resolveContext(m, {
        pickup: pickupLatLng,
        cityIdHint: null,
      });

      const policy = await this.resolveApplicablePolicy(m, {
        at: new Date(),
        cityId,
        zoneId,
        fallbackTimezone: cityTimezone,
      });

      rateCard = this.buildRateCard(policy, cityTimezone);
    }

    // 4) Calcular
    const computed = this.computeFare({
      vehicleRates,
      rateCard,
      multipliers,
      distanceKm,
      durationMin,
      surgeMultiplier: surge,
      extrasTotal,
    });

    // 5) Extra lines meta SIN null
    const meta: Record<string, unknown> | undefined =
      opts?.waitingTimeMinutes != null
        ? { waiting_minutes: r2(opts.waitingTimeMinutes) }
        : undefined;

    const breakdown: FareBreakdown = {
      price_policy_id: rateCard.policyId,
      price_scope_type: rateCard.scopeType,
      timezone_used: rateCard.timezoneUsed,
      rate_card: rateCard,

      vehicle_type_name: vt.name,
      service_class_name: sc?.name ?? '(unknown)',
      category_name: vt.category?.name ?? '(unknown)',
      vehicle_type_id: vt.id,
      service_class_id: sc?.id,
      category_id: vt.category?.id,

      base_fare: r2(computed.base),
      cost_per_km: r4(computed.perKm),
      cost_per_minute: r4(computed.perMin),
      min_fare: r2(computed.minFare),
      booking_fee: r2(computed.bookingFee),

      applied_multipliers: multipliers,

      distance_km_est: distanceKm,
      duration_min_est: durationMin,

      subtotal: r2(computed.subtotal),
      total: r2(computed.totalBase),
      surge_multiplier: surge,

      ...(opts?.waitingTimeMinutes != null
        ? { waiting_time_minutes: r2(opts.waitingTimeMinutes) }
        : {}),
      ...(opts?.waitingReason ? { waiting_reason: opts.waitingReason } : {}),

      ...(extrasTotal > 0
        ? {
            extra_fees_total: extrasTotal,
            extra_lines: [
              {
                code: 'extra_fees',
                label: opts?.waitingReason ?? 'Cargos extra',
                amount: extrasTotal,
                ...(meta ? { meta } : {}),
              },
            ],
          }
        : {}),
    };

    return {
      distanceKm,
      durationMin,
      surgeMultiplier: surge,
      fareTotal: r2(computed.total),
      currency,
      breakdown,
    };
  }

  // ----------------------- Policy resolution -----------------------

  private async resolveApplicablePolicy(
    manager: EntityManager,
    params: {
      at: Date;
      cityId: string | null;
      zoneId: string | null;
      fallbackTimezone: string;
    },
  ): Promise<PricePolicy> {
    const candidates = await this.pricePolicyRepo.listCandidatesForContext({
      at: params.at,
      cityId: params.cityId,
      zoneId: params.zoneId,
      manager,
      take: 50,
    });

    if (!candidates.length) {
      throw new BadRequestException(
        'No price policy configured (no candidates)',
      );
    }

    for (const p of candidates) {
      const tz =
        (p.timezone && p.timezone.trim()) || params.fallbackTimezone || 'UTC';
      if (this.conditionsApply(p.conditions ?? {}, params.at, tz)) return p;
    }

    throw new BadRequestException(
      'No applicable price policy found for this context/time',
    );
  }

  private buildRateCard(
    policy: PricePolicy,
    fallbackTimezone: string,
  ): RateCard {
    const tz =
      (policy.timezone && policy.timezone.trim()) || fallbackTimezone || 'UTC';

    const price: PricePolicyPrice = policy.price ?? {};

    // ✅ FACTORES (default 1)
    const baseFactor = Number(price.base_fare ?? 1);
    const perKmFactor = Number(price.per_km ?? 1);
    const perMinFactor = Number(price.per_minute ?? 1);
    const minFareFactor = Number(price.minimum_fare ?? 1);

    // ✅ FIJOS (default 0)
    const bookingFee = Number(price.booking_fee ?? 0);
    const nightSurcharge = Number(price.night_surcharge ?? 0);

    const cap = price.cap != null ? Number(price.cap) : null;

    return {
      policyId: policy.id,
      scopeType: policy.scopeType,
      timezoneUsed: tz,

      base_fare: r4(baseFactor),
      per_km: r4(perKmFactor),
      per_minute: r4(perMinFactor),
      minimum_fare: r4(minFareFactor),

      booking_fee: r2(bookingFee),
      night_surcharge: r2(nightSurcharge),
      cap: cap != null ? r2(cap) : null,
    };
  }

  // ----------------------- Conditions evaluation -----------------------

  private conditionsApply(
    cond: PricePolicyConditions,
    atUtc: Date,
    timeZone: string,
  ): boolean {
    // default: si no hay condiciones, aplica
    const hasAny =
      !!cond.days_of_week?.length ||
      !!cond.time_ranges?.length ||
      !!cond.dates?.length ||
      !!cond.date_ranges?.length ||
      !!cond.exclude_dates?.length;

    if (!hasAny) return true;

    const local = this.getLocalParts(atUtc, timeZone);

    // exclude_dates
    if (cond.exclude_dates?.length) {
      if (cond.exclude_dates.includes(local.date)) return false;
    }

    // dates (whitelist)
    if (cond.dates?.length) {
      if (!cond.dates.includes(local.date)) return false;
    }

    // date_ranges (whitelist)
    if (cond.date_ranges?.length) {
      const ok = cond.date_ranges.some((r) => {
        const from = r.from;
        const to = r.to;
        return local.date >= from && local.date <= to;
      });
      if (!ok) return false;
    }

    // days_of_week (whitelist)
    if (cond.days_of_week?.length) {
      if (!cond.days_of_week.includes(local.dayOfWeek)) return false;
    }

    // time_ranges (whitelist)
    if (cond.time_ranges?.length) {
      const ok = cond.time_ranges.some((tr) =>
        this.timeInRange(local.time, tr.start, tr.end),
      );
      if (!ok) return false;
    }

    return true;
  }

  // local.date: YYYY-MM-DD, local.time: HH:MM, dayOfWeek: 1..7 (Mon..Sun)
  private getLocalParts(
    atUtc: Date,
    timeZone: string,
  ): {
    date: string;
    time: string;
    dayOfWeek: number;
  } {
    // date/time in en-CA gives YYYY-MM-DD
    const dateFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const timeFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const weekdayFmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
    });

    const date = dateFmt.format(atUtc); // YYYY-MM-DD
    const time = timeFmt.format(atUtc); // HH:MM
    const wd = weekdayFmt.format(atUtc); // Mon, Tue...

    const dayOfWeek = this.mapWeekdayShortToIso(wd);
    return { date, time, dayOfWeek };
  }

  private mapWeekdayShortToIso(wd: string): number {
    // ISO: Mon=1 .. Sun=7
    const map: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };
    return map[wd] ?? 1;
  }

  private timeInRange(
    currentHHMM: string,
    startHHMM: string,
    endHHMM: string,
  ): boolean {
    // soporta rango normal: 07:00-09:00
    // y rango cruzando medianoche: 22:00-02:00
    const c = this.hhmmToMinutes(currentHHMM);
    const s = this.hhmmToMinutes(startHHMM);
    const e = this.hhmmToMinutes(endHHMM);

    if (Number.isNaN(c) || Number.isNaN(s) || Number.isNaN(e)) return false;

    if (s <= e) return c >= s && c < e;
    // overnight
    return c >= s || c < e;
  }

  private hhmmToMinutes(hhmm: string): number {
    const [hStr, mStr] = hhmm.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.NaN;
    return h * 60 + m;
  }

  // ----------------------- Compute math -----------------------

  private computeFare(params: {
    vehicleRates: {
      baseFare: number;
      perKm: number;
      perMinute: number;
      minFare: number;
    };
    rateCard: RateCard;
    multipliers: AppliedMultipliers;
    distanceKm: number;
    durationMin: number;
    surgeMultiplier: number;
    extrasTotal: Money;
  }): {
    base: Money;
    perKm: Money;
    perMin: Money;
    minFare: Money;
    bookingFee: Money;
    subtotal: Money;
    totalBase: Money;
    total: Money;
  } {
    const {
      vehicleRates,
      rateCard,
      multipliers,
      distanceKm,
      durationMin,
      surgeMultiplier,
      extrasTotal,
    } = params;

    // 1) VehicleType rates * serviceClass multipliers
    const base0 = Number(vehicleRates.baseFare) * multipliers.base;
    const perKm0 = Number(vehicleRates.perKm) * multipliers.per_km;
    const perMin0 = Number(vehicleRates.perMinute) * multipliers.per_min;
    const minFare0 = Number(vehicleRates.minFare) * multipliers.min_fare;

    // 2) Policy factors
    const base = base0 * Number(rateCard.base_fare);
    const perKm = perKm0 * Number(rateCard.per_km);
    const perMin = perMin0 * Number(rateCard.per_minute);
    const minFare = minFare0 * Number(rateCard.minimum_fare);

    // 3) Fixed fees from policy
    const bookingFee = Number(rateCard.booking_fee);
    const nightSurcharge = Number(rateCard.night_surcharge);

    const subtotal =
      base +
      perKm * distanceKm +
      perMin * durationMin +
      bookingFee +
      nightSurcharge;

    const totalBase = Math.max(subtotal, minFare);
    const surged = totalBase * Number(surgeMultiplier ?? 1);

    const capped =
      rateCard.cap != null ? Math.min(surged, Number(rateCard.cap)) : surged;

    const total = capped + Number(extrasTotal ?? 0);

    return {
      base: r2(base),
      perKm: r4(perKm),
      perMin: r4(perMin),
      minFare: r2(minFare),
      bookingFee: r2(bookingFee),
      subtotal: r2(subtotal),
      totalBase: r2(totalBase),
      total: r2(total),
    };
  }

  // ----------------------- Context resolution -----------------------

  private async resolveContext(
    manager: EntityManager,
    params: { pickup: { lat: number; lng: number }; cityIdHint: string | null },
  ): Promise<{
    cityId: string | null;
    zoneId: string | null;
    cityTimezone: string;
  }> {
    // City
    let cityId: string | null = params.cityIdHint;
    let cityTimezone = 'UTC';

    if (cityId) {
      const city = await this.cityRepo.findById(cityId, manager);
      if (city) cityTimezone = city.timezone ?? 'UTC';
      else cityId = null;
    } else {
      const city = await this.cityRepo.findBestByPoint(params.pickup, manager);
      if (city) {
        cityId = city.id;
        cityTimezone = city.timezone ?? 'UTC';
      }
    }

    // Zone (solo si tenemos city)
    let zoneId: string | null = null;
    if (cityId) {
      const zone = await this.zoneRepo.findBestByPoint(cityId, params.pickup, {
        onlyActive: true,
      });
      zoneId = zone?.id ?? null;
    }

    return { cityId, zoneId, cityTimezone };
  }

  // ----------------------- Vehicle helpers -----------------------

  private async findEligibleVehicleType(
    manager: EntityManager,
    params: { vehicleCategoryId: string; serviceClassId: string },
  ): Promise<VehicleType | null> {
    return manager
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
  }

  private extractMultipliers(sc: VehicleServiceClass): AppliedMultipliers {
    return {
      base: Number(sc.baseFareMultiplier ?? 1),
      per_km: Number(sc.costPerKmMultiplier ?? 1),
      per_min: Number(sc.costPerMinuteMultiplier ?? 1),
      min_fare: Number(sc.minFareMultiplier ?? 1),
    };
  }

  private defaultMultipliers(): AppliedMultipliers {
    return { base: 1, per_km: 1, per_min: 1, min_fare: 1 };
  }

  private tryGetRateCardFromBreakdown(
    breakdown: FareBreakdown | null,
  ): RateCard | null {
    if (!breakdown?.rate_card) return null;
    const rc = breakdown.rate_card;
    // validación mínima
    if (!rc.policyId || !rc.scopeType || !rc.timezoneUsed) return null;
    return rc;
  }

  // ----------------------- Geo helpers -----------------------

  private pointToLatLng(p: Point): { lat: number; lng: number } {
    const [lng, lat] = p.coordinates as [number, number];
    return { lat, lng };
  }

  private chainHaversineKm(points: Point[]): number {
    if (points.length < 2) return 0;
    let acc = 0;
    for (let i = 0; i < points.length - 1; i++) {
      acc += this.haversineKm(points[i], points[i + 1]);
    }
    return acc;
  }

  private haversineKm(a: Point, b: Point): number {
    const R = 6371;
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

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
