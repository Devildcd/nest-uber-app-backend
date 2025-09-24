import { Trip } from 'src/modules/trip/entities/trip.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * TRIP_STOPS — Paradas múltiples de un viaje
 * Buenas prácticas incluidas:
 * - Unicidad (trip_id, seq) para asegurar orden único por viaje
 * - Índices para consultas frecuentes (trip_id, place_id, reached_at, point)
 * - Constraints de consistencia (seq >= 0, reached_at >= planned_arrival_at)
 * - Timestamps de auditoría
 */
@Entity({ name: 'trip_stops' })
@Index('ux_trip_stops_trip_seq', ['tripId', 'seq'], { unique: true })
@Index('idx_trip_stops_trip_id', ['tripId'])
@Index('idx_trip_stops_place_id', ['placeId'])
@Check(`"seq" >= 0`)
@Check(
  `("reached_at" IS NULL OR "planned_arrival_at" IS NULL OR "reached_at" >= "planned_arrival_at")`,
)
export class TripStop {
  /** PK */
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  /**
   * FK → trips.id
   * Definimos columna explícita + relación (patrón recomendado para poder indexar trip_id y usarlo en queries sin cargar relación).
   */
  @Column('uuid', { name: 'trip_id' })
  tripId: string;

  @ManyToOne(() => Trip, (t) => t.stops, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trip_id', referencedColumnName: 'id' })
  trip: Trip;

  /**
   * Orden de la parada dentro del viaje.
   * 0 = pickup, 1..n = paradas intermedias y/o dropoff (según tu modelado).
   */
  @Column('int', { name: 'seq' })
  seq: number;

  /**
   * Ubicación geográfica de la parada (WGS84).
   * Requiere extensión PostGIS habilitada.
   *
   * Nota: Para index espacial, añadimos un índice GIST/GIN sobre esta columna.
   */
  @Index('gix_trip_stops_point', { spatial: true })
  @Column({
    type: 'geography',
    name: 'point',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  point: string; // TypeORM usa string para geography; puedes envolver con un tipo propio si prefieres.

  /** Dirección legible (opcional) */
  @Column('text', { name: 'address', nullable: true })
  address?: string | null;

  /** Place ID (ej. Google Places), opcional */
  @Column('text', { name: 'place_id', nullable: true })
  placeId?: string | null;

  /** ETA planificada (opcional) */
  @Column('timestamptz', { name: 'planned_arrival_at', nullable: true })
  plannedArrivalAt?: Date | null;

  /** Hora real de llegada (opcional) */
  @Column('timestamptz', { name: 'reached_at', nullable: true })
  reachedAt?: Date | null;

  /** Notas (opcional) */
  @Column('text', { name: 'notes', nullable: true })
  notes?: string | null;

  /** Auditoría */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
