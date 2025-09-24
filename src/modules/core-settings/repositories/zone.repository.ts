import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { Zone } from '../entities/zone.entity';

@Injectable()
export class ZoneRepository extends BaseRepository<Zone> {
  constructor(ds: DataSource) {
    super(Zone, ds.createEntityManager(), 'ZoneRepository', 'Zone');
  }

  /** Requiere PostGIS (shape como polygon geography 4326) */
  async findActiveZoneContaining(
    point: { lat: number; lng: number },
    cityCode?: string,
  ): Promise<Zone | null> {
    try {
      const params: any[] = [point.lng, point.lat];
      let sql = `
        SELECT z.*
        FROM zones z
        WHERE z.is_active = TRUE
          AND ST_Contains(
            z.shape,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          )
      `;
      if (cityCode) {
        sql += ` AND z.city_code = $3`;
        params.push(cityCode);
      }
      sql += ` ORDER BY z.priority DESC NULLS LAST, z.updated_at DESC LIMIT 1`;

      const rows: Zone[] = await this.manager.query(sql, params);
      return rows[0] ?? null;
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findActiveZoneContaining',
        this.entityName,
      );
    }
  }

  /** Alternativa sin PostGIS: zonas circulares (center_lat, center_lng, radius_m) */
  async findActiveCircleZoneContaining(
    point: { lat: number; lng: number },
    cityCode?: string,
  ): Promise<Zone | null> {
    try {
      // Pre-filtrado por ciudad y activo; el chequeo de distancia lo haces en JS o SQL con Haversine.
      const qb = this.qb('z').where('z.is_active = TRUE');
      if (cityCode) qb.andWhere('z.city_code = :city', { city: cityCode });

      const zones = await qb.orderBy('z.priority', 'DESC').getMany();
      // Haversine rápido en memoria (puedes moverlo a common/utils/geo.util)
      const toRad = (d: number) => (d * Math.PI) / 180;
      const R = 6371000; // m
      const dists = zones
        .map((z) => {
          const dLat = toRad(point.lat - (z as any).centerLat);
          const dLng = toRad(point.lng - (z as any).centerLng);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad((z as any).centerLat)) *
              Math.cos(toRad(point.lat)) *
              Math.sin(dLng / 2) ** 2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const dist = R * c;
          return { z, inside: dist <= (z as any).radiusMeters, dist };
        })
        .filter((x) => x.inside)
        .sort(
          (a, b) => ((b.z as any).priority ?? 0) - ((a.z as any).priority ?? 0),
        );

      return dists[0]?.z ?? null;
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findActiveCircleZoneContaining',
        this.entityName,
      );
    }
  }
}
