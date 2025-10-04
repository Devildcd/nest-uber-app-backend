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
import { Trip } from './trip.entity';
import { User } from 'src/modules/user/entities/user.entity';
import { Vehicle } from 'src/modules/vehicles/entities/vehicle.entity';

export enum AssignmentStatus {
  OFFERED = 'offered',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'trip_assignments' })
// @Index('idx_trip_assignments_trip', ['tripId'])
// @Index('idx_trip_assignments_driver', ['driverId'])
// @Index('idx_trip_assignments_status', ['status'])
// @Index('idx_trip_assignments_trip_status', ['tripId', 'status'])
// @Index('idx_trip_assignments_offered_at', ['offeredAt'])
// @Index('idx_trip_assignments_trip_driver', ['tripId', 'driverId'])
// Máximo 1 ACCEPTED por viaje
// @Index('uniq_ta_one_accepted_per_trip', ['tripId'], {
//   unique: true,
//   where: `"status" = 'accepted'`,
// })
// Solo una oferta ACTIVA por (trip,driver) a la vez (sin respuesta)
// @Index('uniq_ta_active_offer_per_trip_driver', ['tripId', 'driverId'], {
//   unique: true,
//   where: `"status" = 'offered' AND "responded_at" IS NULL`,
// })
// Índice para job de expiración rápido
// @Index('idx_ta_expirable', [], {
//   where: `"status" = 'offered' AND "ttl_expires_at" IS NOT NULL`,
// })
@Check(`"offered_at" IS NOT NULL`)
@Check(`("responded_at" IS NULL OR "responded_at" >= "offered_at")`)
export class TripAssignment {
  /** PK */
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @ManyToOne(() => Trip, (t) => t.assignments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trip_id', referencedColumnName: 'id' })
  trip: Trip;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'driver_id', referencedColumnName: 'id' })
  driver: User;

  @ManyToOne(() => Vehicle, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehicle_id', referencedColumnName: 'id' })
  vehicle: Vehicle;

  /** Estado de la oferta */
  @Column({
    type: 'enum',
    enum: AssignmentStatus,
    enumName: 'assignment_status',
    name: 'status',
    default: AssignmentStatus.OFFERED, // <-- default
  })
  status: AssignmentStatus;

  /** Momento de la oferta (requerido) */
  @Column('timestamptz', { name: 'offered_at', default: () => 'now()' }) // <-- default
  offeredAt: Date;

  /** Momento de respuesta (aceptar/rechazar/expirar/cancelar), opcional */
  @Column('timestamptz', { name: 'responded_at', nullable: true })
  respondedAt?: Date | null;

  /**
   * TTL de la oferta (ej. offered_at + 20s) — lo calcula la app al crear.
   * Útil para jobs que expiran automáticamente.
   */
  @Column('timestamptz', { name: 'ttl_expires_at', nullable: true })
  ttlExpiresAt?: Date | null;

  // Auditoría: ETA al pickup, distancia, motivo rechazo/expiración, etc.
  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;

  /** Auditoría */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
