import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { DriverProfile } from '../../driver-profiles/entities/driver-profile.entity';
import { VehicleType } from '../../vehicle-types/entities/vehicle-types.entity';

export enum VehicleStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  MAINTENANCE = 'maintenance',
  UNAVAILABLE = 'unavailable',
}
/**
 * Entity: vehicles
 * Registro maestro de vehículos físicos en la plataforma.
 */
@Entity({ name: 'vehicles' })

@Index(['plateNumber'])
@Index(['vehicleType'])
@Index(['isActive'])
@Index(['status'])
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_vehicle_driver')
  @ManyToOne(() => User, (user) => user.vehicles, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'driver_id' })
  driver: User;

  @Index('idx_vehicle_driver_profile')
  @ManyToOne(() => DriverProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_profile_id' })
  driverProfile: DriverProfile;
  
  @Index('idx_vehicle_vehicle_type')
  @ManyToOne(() => VehicleType, (vt) => vt.vehicles, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vehicle_type_id' })
  vehicleType: VehicleType;

  @Column({ length: 50 })
  make: string;

  @Column({ length: 50 })
  model: string;

  @Column({ type: 'int' })
  year: number;

  @Index('uq_vehicle_plate_number', { unique: true })
  @Column({ name: 'plate_number', type: 'varchar', length: 15, unique: true })
  plateNumber: string;

  @Column({ nullable: true, length: 30 })
  color?: string;

  @Column({ type: 'int', default: 1 })
  capacity: number;
  
  @Index('idx_vehicle_is_active')
  @Column({ default: true })
  isActive: boolean;

  @Index('idx_vehicle_status')
  @Column({
    type: 'enum',
    enum: VehicleStatus,
    default: VehicleStatus.PENDING_REVIEW,
  })
  status: VehicleStatus;

  @Column({ name: 'inspection_date', type: 'timestamptz', nullable: true })
  inspectionDate?: Date;

  @Column({ name: 'last_maintenance_date', type: 'timestamptz', nullable: true })
  lastMaintenanceDate?: Date;

  @Column({ type: 'bigint', nullable: true })
  mileage?: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
