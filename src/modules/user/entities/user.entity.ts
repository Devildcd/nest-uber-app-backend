import { AuthCredentials } from 'src/modules/user/entities/auth-credentials.entity';
import { Session } from 'src/modules/auth/entities/session.entity';
import { Vehicle } from 'src/modules/vehicles/entities/vehicle.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
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

  @OneToOne(() => AuthCredentials, (authCredentials) => authCredentials.user)
  authCredentials: AuthCredentials;

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];

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

  @OneToMany(() => Vehicle, (vehicle) => vehicle.driver)
  vehicles: Vehicle[];

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

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
