import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum SessionType {
  WEB = 'web',
  MOBILE_APP = 'mobile_app',
  ADMIN_PANEL = 'admin_panel',
  API_CLIENT = 'api_client',
}

@Entity({ name: 'sessions' })
@Index(['accessToken'])
@Index(['refreshToken'])
@Index(['lastSuccessfulLoginAt'])
@Index(['lastActivityAt'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.sessions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  user: User;

  @Column({ type: 'enum', enum: SessionType, default: SessionType.WEB })
  sessionType: SessionType;

  @Column({ unique: true })
  accessToken: string;

  @Column({ unique: true })
  refreshToken: string;

  @Column({ type: 'timestamptz' })
  accessTokenExpiresAt: Date;

  @Column({ type: 'timestamptz' })
  refreshTokenExpiresAt: Date;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastSuccessfulLoginAt: Date;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  lastActivityAt: Date;

  @Column({ type: 'json', nullable: true })
  deviceInfo?: {
    os?: string;
    browser?: string;
    model?: string;
    appVersion?: string;
  };

  @Column({ nullable: true, length: 45 })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'json', nullable: true })
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
  };

  @Column({ default: false })
  mfaVerified: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ unique: true })
  jti: string;

  @Column({ type: 'boolean', default: false })
  revoked: boolean;
}
