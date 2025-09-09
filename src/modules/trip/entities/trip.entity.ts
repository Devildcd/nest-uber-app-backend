import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

import { User } from 'src/modules/user/entities/user.entity';
import { Vehicle } from 'src/modules/vehicles/entities/vehicle.entity';
import { FareBreakdown } from '../interfaces/trip.interfaces';

// ---------- ENUMS ----------
export enum TripStatus {
  PENDING = 'pending',
  ASSIGNING = 'assigning',
  ACCEPTED = 'accepted',
  ARRIVING = 'arriving',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_DRIVERS_FOUND = 'no_drivers_found',
  DRIVER_REJECTED = 'driver_rejected',
}

export enum PaymentMode {
  CASH = 'cash',
  CARD = 'card',
  WALLET = 'wallet',
  // extiende según tu sistema de pagos...
}

// ---------- INTERFACES ----------
export type GeoPoint = { type: 'Point'; coordinates: [number, number] }; // [lng, lat]

// ---------- TRANSFORMERS ----------
export const DecimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? null : Number(value),
};

// ---------- ENTITY ----------
@Entity({ name: 'trips' })
@Index('idx_trips_status', ['currentStatus'])
@Index('idx_trips_passenger', ['passenger'])
@Index('idx_trips_driver', ['driver'])
@Index('idx_trips_vehicle', ['vehicle'])
@Index('idx_trips_requested_at', ['requestedAt'])
export class Trip {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  // Pasajero (FK → users._id)
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'passenger_id' })
  passenger: User;

  // Conductor (FK → users._id, NULL hasta aceptación)
  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'driver_id' })
  driver?: User | null;

  // Vehículo (FK → vehicles._id, NULL hasta aceptación)
  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle?: Vehicle | null;

  // Orden de pago digital (opcional)
  // @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  // @JoinColumn({ name: 'order_id' })
  // order?: Order | null;

  @Column({
    name: 'payment_mode',
    type: 'enum',
    enum: PaymentMode,
  })
  paymentMode: PaymentMode;

  @Column({
    name: 'current_status',
    type: 'enum',
    enum: TripStatus,
    default: TripStatus.PENDING,
  })
  currentStatus: TripStatus;

  @Column({ name: 'requested_at', type: 'timestamptz' })
  requestedAt: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt?: Date | null;

  @Column({ name: 'pickup_eta_at', type: 'timestamptz', nullable: true })
  pickupEtaAt?: Date | null;

  @Column({ name: 'arrived_pickup_at', type: 'timestamptz', nullable: true })
  arrivedPickupAt?: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt?: Date | null;

  // GEOGRAFÍA (GeoJSON Point: [lng, lat])
  @Column({
    name: 'pickup_point',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  pickupPoint: GeoPoint;

  @Column({ name: 'pickup_address', type: 'text', nullable: true })
  pickupAddress?: string | null;

  // --- Campos de tarifa / liquidación ---
  @Column({
    name: 'fare_final_currency',
    type: 'char',
    length: 3,
    nullable: true,
  })
  fareFinalCurrency?: string | null;

  @Column({
    name: 'fare_distance_km',
    type: 'numeric',
    precision: 10,
    scale: 3,
    nullable: true,
    transformer: DecimalTransformer,
  })
  fareDistanceKm?: number | null;

  @Column({
    name: 'fare_duration_min',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  fareDurationMin?: number | null;

  @Column({
    name: 'fare_surge_multiplier',
    type: 'numeric',
    precision: 6,
    scale: 3,
    default: 1.0,
    transformer: DecimalTransformer,
  })
  fareSurgeMultiplier: number;

  @Column({
    name: 'fare_total',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  fareTotal?: number | null;

  @Column({ name: 'fare_breakdown', type: 'jsonb', nullable: true })
  fareBreakdown?: FareBreakdown | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/**
 * ⚠️ Índice espacial recomendado (Postgres GIST) para pickup_point:
 * Crear en migración manual:
 *   CREATE INDEX idx_trips_pickup_point_gist ON trips USING GIST (pickup_point);
 */
