import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from 'src/modules/user/entities/user.entity';

export enum VehicleType {
  CAR        = 'car',
  MOTORCYCLE = 'motorcycle',
  VAN        = 'van',
  SUV        = 'suv',
  OTHER      = 'other',
}

export enum VehicleStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED       = 'rejected',
  MAINTENANCE    = 'maintenance',
  UNAVAILABLE    = 'unavailable',
}

@Entity({ name: 'vehicles' })
@Index(['driver'])
@Index(['plateNumber'])
@Index(['vehicleType'])
@Index(['isActive'])
@Index(['status'])
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.vehicles, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  driver: User;

  @Column({ length: 50 })
  make: string;

  @Column({ length: 50 })
  model: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ name: 'plate_number', unique: true, length: 15 })
  plateNumber: string;

  @Column({ nullable: true, length: 30 })
  color?: string;

  @Column({ type: 'enum', enum: VehicleType, default: VehicleType.CAR })
  vehicleType: VehicleType;

  @Column({ type: 'int', default: 4 })
  capacity: number;

  @Column({ nullable: true })
  licensePlateImageUrl?: string;

  @Column({ nullable: true })
  registrationCardUrl?: string;

  @Column({ nullable: true, length: 100 })
  insurancePolicyNumber?: string;

  @Column({ type: 'timestamptz', nullable: true })
  insuranceExpiresAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  inspectionDate?: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'enum', enum: VehicleStatus, default: VehicleStatus.PENDING_REVIEW })
  status: VehicleStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}