import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Point,
  OneToOne,
} from 'typeorm';

import { User } from 'src/modules/user/entities/user.entity';
import { Vehicle } from 'src/modules/vehicles/entities/vehicle.entity';
import { Order } from 'src/modules/orders/entities/order.entity';
import { DecimalTransformer } from 'src/common/validators/decimal.transformer';
import { TripStop } from 'src/modules/trip/entities/trip-stop.entity';
import { TripEvent } from 'src/modules/trip/entities/trip-event.entity';
import { TripAssignment } from './trip-assignment.entity';
import { VehicleCategory } from 'src/modules/vehicle-category/entities/vehicle-category.entity';
import { VehicleServiceClass } from 'src/modules/vehicle-service-classes/entities/vehicle-service-classes.entity';
import { VehicleType } from 'src/modules/vehicle-types/entities/vehicle-types.entity';
import { FareBreakdown } from 'src/common/interfaces/fare-breakdown.interface';

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
  // DRIVER_REJECTED = 'driver_rejected',
}

export enum PaymentMode {
  CASH = 'cash',
  CARD = 'card',
  WALLET = 'wallet',
}

// ---------- INTERFACES ----------
export type GeoPoint = { type: 'Point'; coordinates: [number, number] }; // [lng, lat]

// ---------- ENTITY ----------
@Entity({ name: 'trips' })
@Index('idx_trips_status', ['currentStatus'])
@Index('idx_trips_passenger', ['passenger'])
@Index('idx_trips_driver', ['driver'])
@Index('idx_trips_vehicle', ['vehicle'])
@Index('idx_trips_requested_at', ['requestedAt'])
@Index('idx_trips_req_vehicle_category', ['requestedVehicleCategory'])
@Index('idx_trips_req_service_class', ['requestedServiceClass'])
@Index('idx_trips_est_vehicle_type', ['estimateVehicleType'])
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
  @OneToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order?: Order | null;

  // Relacion inversa con trip_stops
  @OneToMany(() => TripStop, (ts) => ts.trip)
  stops: TripStop[];

  // Relacion inversa con trip_events
  @OneToMany(() => TripEvent, (te) => te.trip)
  events: TripEvent[];

  // relacion inversa con trip_assignment
  @OneToMany(() => TripAssignment, (ta) => ta.trip)
  assignments: TripAssignment[];

  /**
   * Preferencia del pasajero: categoría física (Auto, Moto, Van, …)
   * Se usa para filtrar matching en Fase 2.
   */
  @ManyToOne(() => VehicleCategory, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requested_vehicle_category_id' })
  requestedVehicleCategory?: VehicleCategory | null;

  /**
   * Preferencia del pasajero: clase de servicio (Standard, Premium, …)
   * Se usa para filtrar matching y para multiplicadores del estimate.
   */
  @ManyToOne(() => VehicleServiceClass, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'requested_service_class_id' })
  requestedServiceClass?: VehicleServiceClass | null;

  /**
   * Tipo de vehículo base elegido para calcular el estimate (snapshot).
   * No es el vehículo real asignado. Útil para reproducir el precio mostrado.
   */
  @ManyToOne(() => VehicleType, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'estimate_vehicle_type_id' })
  estimateVehicleType?: VehicleType | null;

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

  @Column({
    name: 'fare_estimated_total',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  fareEstimatedTotal?: number | null;

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
  pickupPoint: Point;

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
    nullable: true,
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
