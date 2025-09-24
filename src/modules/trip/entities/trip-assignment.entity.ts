import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
} from 'typeorm';
import { Trip } from '../../trip/entities/trip.entity';
import { Vehicle } from 'src/modules/vehicles/entities/vehicle.entity';
import { User } from 'src/modules/user/entities/user.entity';

export enum AssignmentStatus {
  OFFERED = 'offered',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'trip_assignments' })
@Index('idx_trip_assignments_trip', ['tripId'])
@Index('idx_trip_assignments_driver', ['driverId'])
@Index('idx_trip_assignments_status', ['status'])
@Index('idx_trip_assignments_trip_status', ['tripId', 'status'])
@Index('idx_trip_assignments_offered_at', ['offeredAt'])
@Check(`"offered_at" IS NOT NULL`)
@Check(`("responded_at" IS NULL OR "responded_at" >= "offered_at")`)
export class TripAssignment {
  /** PK */
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  /** FK → trips.id (columna explícita + relación) */
  @Column('uuid', { name: 'trip_id' })
  tripId: string;

  @ManyToOne(() => Trip, (t) => t.assignments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trip_id', referencedColumnName: 'id' })
  trip: Trip;

  /** FK → user.id (columna explícita + relación) */
  @Column('uuid', { name: 'driver_id' })
  driverId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'driver_id', referencedColumnName: 'id' })
  driver: User;

  /** FK → vehicles.id (vehículo usado en la oferta) */
  @Column('uuid', { name: 'vehicle_id' })
  vehicleId: string;

  @ManyToOne(() => Vehicle, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehicle_id', referencedColumnName: 'id' })
  vehicle: Vehicle;

  /** Estado de la oferta */
  @Column({
    type: 'enum',
    enum: AssignmentStatus,
    enumName: 'assignment_status',
    name: 'status',
  })
  status: AssignmentStatus;

  /** Momento de la oferta (requerido) */
  @Column('timestamptz', { name: 'offered_at' })
  offeredAt: Date;

  /** Momento de respuesta (aceptar/rechazar/expirar/cancelar), opcional */
  @Column('timestamptz', { name: 'responded_at', nullable: true })
  respondedAt?: Date | null;

  /**
   * (Opcional pero recomendado) Vencimiento de la oferta para TTL (p. ej. 20s).
   * Útil para jobs que expiran automáticamente.
   */
  @Index('idx_trip_assignments_ttl_expires_at')
  @Column('timestamptz', { name: 'ttl_expires_at', nullable: true })
  ttlExpiresAt?: Date | null;

  /** Auditoría */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
