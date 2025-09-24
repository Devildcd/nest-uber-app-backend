import { Trip } from 'src/modules/trip/entities/trip.entity';
import { TripEventType } from 'src/modules/trip/interfaces/trip-event-types.enum';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  Check,
} from 'typeorm';

/**
 * Tipos de evento principales de un viaje.
 * Suma aquí los que usarás de forma "oficial" (permite validación y mejores índices).
 * Si necesitas flexibilidad extrema, puedes modelar eventType como TEXT;
 * en esta variante usamos ENUM para robustez y performance.
 */

@Entity({ name: 'trip_events' })
@Index('idx_trip_events_trip_id', ['tripId'])
@Index('idx_trip_events_event_type', ['eventType'])
@Index('idx_trip_events_trip_occurred', ['tripId', 'occurredAt'])
@Check(`occurred_at IS NOT NULL`)
export class TripEvent {
  /** PK */
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  /**
   * FK → trips.id
   * Patrón recomendado: columna explícita + relación para poder indexar y consultar sin cargar relación.
   */
  @Column('uuid', { name: 'trip_id' })
  tripId: string;

  @ManyToOne(() => Trip, (t) => t.events, {
    nullable: false,
    onDelete: 'CASCADE', // si se borra el trip, se borra su timeline
  })
  @JoinColumn({ name: 'trip_id', referencedColumnName: 'id' })
  trip: Trip;

  /** Tipo de evento (ENUM) */
  @Column({
    type: 'enum',
    enum: TripEventType,
    enumName: 'trip_event_type', // nombre del tipo enum en PG
    name: 'event_type',
  })
  eventType: TripEventType;

  /**
   * Datos contextuales del evento.
   * JSONB permite almacenar payloads heterogéneos (driver_id, reasons, amounts, etc).
   *
   * NOTA (performance): crea un índice GIN sobre JSONB en una migración:
   *   CREATE INDEX idx_trip_events_metadata_gin ON trip_events USING gin (metadata);
   * TypeORM no soporta `using: 'gin'` en @Index; hazlo en migration.
   */
  @Column('jsonb', { name: 'metadata', nullable: true })
  metadata?: Record<string, any> | null;

  /**
   * Momento del evento (cuando ocurrió en negocio).
   * Suele venir de la aplicación; preferimos timestamptz para TZ-aware.
   */
  @Column('timestamptz', { name: 'occurred_at' })
  occurredAt: Date;

  /**
   * Momento de inserción del registro en BD (auditoría técnica).
   * Omitimos UpdateDateColumn para mantener el registro inmutable.
   */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
