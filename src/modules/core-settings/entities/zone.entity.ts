import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  UpdateDateColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'zones' })
@Index('idx_zones_city_code', ['cityCode'])
@Index('idx_zones_active', ['isActive'])
@Index('idx_zones_priority', ['priority'])
export class Zone {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  /** City code que matchea el usado en pricing_settings.scope_ref cuando scope_type = 'city' */
  @Column('text', { name: 'city_code' })
  cityCode: string;

  @Column('text', { name: 'name' })
  name: string;

  /**
   * Geometría de la zona.
   * Requiere PostGIS habilitado. Usamos geography Polygon WGS84.
   */
  @Index('gix_zones_shape', { spatial: true })
  @Column({
    type: 'geography',
    name: 'shape',
    spatialFeatureType: 'Polygon',
    srid: 4326,
    nullable: false,
  })
  shape: string; // TypeORM representa geography como string.

  /**
   * En caso de solaparse dos zonas, gana la de mayor prioridad.
   * Puedes dejar null (misma prioridad) y desempatar por updated_at desc.
   */
  @Column('int', { name: 'priority', nullable: true })
  priority?: number | null;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  /** Auditoría */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/**
 * NOTAS:
 * - Crea índice GIST sobre shape en migración (si tu versión de TypeORM no genera spatial index correcto):
 *   CREATE INDEX gix_zones_shape ON zones USING GIST (shape);
 *
 * - Si vas a consultar "zona que contiene punto": ST_Contains(shape, point).
 * - Cuando no haya match de zona, tu resolución de pricing cae a city o global.
 */
