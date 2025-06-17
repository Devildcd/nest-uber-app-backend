import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  //   ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum UserType {
  PASSENGER = 'passenger',
  DRIVER = 'driver',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
}

@Entity({ name: 'users' })
@Index(['email'])
@Index(['emailVerified'])
@Index(['phoneNumber'])
@Index(['phoneNumberVerified'])
@Index(['userType'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true, length: 150 })
  email: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true, length: 20 })
  phoneNumber?: string;

  @Column({ default: false })
  phoneNumberVerified: boolean;

  @Column({ type: 'enum', enum: UserType })
  userType: UserType;

  @Column({ nullable: true })
  profilePictureUrl?: string;

  @Column({ type: 'json', nullable: true })
  currentLocation?: { latitude: number; longitude: number };

  // @ManyToOne(() => Vehicle, (vehicle) => vehicle.id, { nullable: true })
  // vehicle?: any;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ nullable: true, length: 10 })
  preferredLanguage?: string;

  @Column({ type: 'timestamptz', nullable: true })
  termsAcceptedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  privacyPolicyAcceptedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
