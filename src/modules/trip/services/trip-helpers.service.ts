import { Injectable } from '@nestjs/common';
import { Point } from 'geojson';
import { VehicleServiceClass } from 'src/modules/vehicle-service-classes/entities/vehicle-service-classes.entity';
import { VehicleType } from 'src/modules/vehicle-types/entities/vehicle-types.entity';
import { DataSource, EntityManager } from 'typeorm';
import { FareBreakdown } from '../interfaces/trip.interfaces';

@Injectable()
export class TripHelpersService {
  constructor(private readonly dataSource: DataSource) {}
  /**
   * Calcula un estimado con:
   * - vehicle_types (base_fare, cost_per_km, cost_per_minute, min_fare)
   * - vehicle_service_classes (multipliers)
   * - distancia Haversine pickup -> stops encadenados
   * - duración aprox: (dist_km / 30 km/h) * 60
   *
   * TODO: integrar pricing_settings (city/zone/global), booking_fee, surge dinámico, etc.
   */
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
      .orderBy('vt.baseFare', 'ASC') // criterio simple (puedes refinar luego)
      .getOne();

    // 2) Service class (multipliers)
    const scEntity = await m.getRepository(VehicleServiceClass).findOne({
      where: { id: params.serviceClassId },
    });

    // Fallback si falta VT o SC
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
        cost_per_minute: 0,
        min_fare: 0,

        applied_multipliers: { base: 1, per_km: 1, per_min: 1, min_fare: 1 },
        distance_km_est: 0,
        duration_min_est: 0,
        subtotal: 0,
        total: 0,
        surge_multiplier: 1,
      };

      return {
        currency,
        surgeMultiplier: 1,
        totalEstimated: 0,
        breakdown,
      };
    }

    // 3) Aplicar multiplicadores de la service class
    const vtBase = Number(vt.baseFare);
    const vtPerKm = Number(vt.costPerKm);
    const vtPerMin = Number(vt.costPerMinute);
    const vtMinFare = Number(vt.minFare);

    const mulBase = Number(scEntity.baseFareMultiplier);
    const mulKm = Number(scEntity.costPerKmMultiplier);
    const mulMin = Number(scEntity.costPerMinuteMultiplier);
    const mulMinFare = Number(scEntity.minFareMultiplier);

    const base = vtBase * mulBase;
    const perKm = vtPerKm * mulKm;
    const perMin = vtPerMin * mulMin;
    const minFare = vtMinFare * mulMinFare;

    // 4) Distancia/tiempo estimados (Haversine encadenado)
    const allPoints: Point[] = [params.pickup, ...(params.stops ?? [])];
    const distKm = this.chainHaversineKm(allPoints);
    const durMin = (distKm / 30) * 60; // 30 km/h promedio

    // 5) Subtotal y surge (por ahora fijo 1.0)
    const surge = 1.0;
    const subtotal = base + perKm * distKm + perMin * durMin;
    const totalBase = Math.max(subtotal, minFare);
    const total = totalBase * surge;

    const round2 = (n: number) => Number(n.toFixed(2));
    const round3 = (n: number) => Number(n.toFixed(3));
    const round4 = (n: number) => Number(n.toFixed(4));

    const breakdown: FareBreakdown = {
      // Nombres legibles
      vehicle_type_name: vt.name,
      service_class_name: scEntity.name,
      category_name: vt.category?.name ?? '(unknown)',

      // IDs opcionales (auditoría)
      vehicle_type_id: vt.id,
      service_class_id: scEntity.id,
      category_id: vt.category?.id,

      // valores ya multiplicados
      base_fare: round2(base),
      cost_per_km: round4(perKm),
      cost_per_minute: round4(perMin),
      min_fare: round2(minFare),

      applied_multipliers: {
        base: mulBase,
        per_km: mulKm,
        per_min: mulMin,
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
}
