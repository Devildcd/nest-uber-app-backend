import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum AuthMethod {
  LOCAL = 'local',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  APPLE = 'apple',
}

@Entity({ name: 'auth_credentials' })
@Index('idx_auth_credentials_user', ['user'], { unique: true })
@Index('idx_auth_credentials_password_reset_token', ['passwordResetToken'])
@Index('idx_auth_credentials_email_verification_token', [
  'emailVerificationToken',
])
@Index('idx_auth_credentials_phone_verification_token', [
  'phoneVerificationToken',
])
export class AuthCredentials {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: AuthMethod,
    default: AuthMethod.LOCAL,
  })
  authenticationMethod: AuthMethod;

  @Column({ name: 'password_hash', nullable: true })
  passwordHash?: string;

  @Column({ nullable: true })
  salt?: string;

  @Column({ type: 'json', nullable: true })
  oauthProviders?: {
    googleId?: string;
    facebookId?: string;
    appleId?: string;
  };

  @Column({ name: 'password_reset_token', unique: true, nullable: true })
  passwordResetToken?: string;

  @Column({
    name: 'password_reset_token_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  passwordResetTokenExpiresAt?: Date;

  @Column({ name: 'mfa_enabled', type: 'boolean', default: false })
  mfaEnabled: boolean;

  @Column({ name: 'mfa_secret', nullable: true })
  mfaSecret?: string;

  @Column({
    name: 'last_password_change_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastPasswordChangeAt?: Date;

  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ name: 'lockout_until', type: 'timestamptz', nullable: true })
  lockoutUntil?: Date;

  @Column({ name: 'email_verification_token', unique: true, nullable: true })
  emailVerificationToken?: string;

  @Column({
    name: 'email_verification_token_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  emailVerificationTokenExpiresAt?: Date;

  @Column({ name: 'phone_verification_token', unique: true, nullable: true })
  phoneVerificationToken?: string;

  @Column({
    name: 'phone_verification_token_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  phoneVerificationTokenExpiresAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
