import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Check,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum BackgroundCheckStatus {
  PENDING_BACKGROUND_CHECK = 'pending_background_check',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum DriverStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  ON_VACATION = 'on_vacation',
  PENDING_DOCS = 'pending_docs',
  DEACTIVATED = 'deactivated',
}

@Entity({ name: 'driver_profiles' })
@Index(['user'], { unique: true })
@Index(['driverLicenseNumber'], { unique: true })
@Index(['backgroundCheckStatus'])
@Index(['isApproved'])
@Index(['driverStatus'])
// Invariantes de negocio reforzadas en DB:
@Check(`("driver_status" <> 'deactivated') OR ("is_approved" = false)`)
@Check(
  `("background_check_status" <> 'rejected') OR ("is_approved" = false AND "driver_status" = 'suspended')`,
)
@Check(`("driver_status" <> 'active') OR ("is_approved" = true)`)
export class DriverProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'driver_license_number', length: 50, unique: true })
  driverLicenseNumber: string;

  @Column({ name: 'driver_license_expiration_date', type: 'date' })
  driverLicenseExpirationDate: Date;

  @Column({ name: 'driver_license_picture_url', nullable: true })
  driverLicensePictureUrl?: string;

  @Column({
    name: 'background_check_status',
    type: 'enum',
    enum: BackgroundCheckStatus,
    default: BackgroundCheckStatus.PENDING_BACKGROUND_CHECK, // ✅
  })
  backgroundCheckStatus: BackgroundCheckStatus;

  @Column({
    name: 'background_check_date',
    type: 'timestamptz',
    nullable: true,
  })
  backgroundCheckDate?: Date;

  @Column({ name: 'is_approved', default: false })
  isApproved: boolean;

  @Column({ type: 'json', nullable: true })
  emergencyContactInfo?: {
    name: string;
    phoneNumber: string;
    relationship: string;
  };

  @Column({
    name: 'driver_status',
    type: 'enum',
    enum: DriverStatus,
    default: DriverStatus.PENDING_DOCS,
  })
  driverStatus: DriverStatus;

  @Column({ name: 'paid_priority_until', type: 'timestamptz', nullable: true })
  paidPriorityUntil?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
