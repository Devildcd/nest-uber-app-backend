import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum IdemStatus {
  IN_PROGRESS = 'in_progress',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

@Entity({ name: 'idempotency_keys' })
@Index(['userId', 'endpoint', 'createdAt'])
@Index(['expiresAt'])
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'text', unique: true }) key: string;

  @Column({ type: 'varchar', length: 10 }) method: string; // POST/PUT/DELETE/PATCH
  @Column({ type: 'varchar', length: 120 }) endpoint: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId?:
    | string
    | null;
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true }) tenantId?:
    | string
    | null;

  @Column({ name: 'request_hash', type: 'char', length: 64, nullable: true })
  requestHash?: string | null;

  @Column({ type: 'enum', enum: IdemStatus, default: IdemStatus.IN_PROGRESS })
  status: IdemStatus;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt?: Date | null;
  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil?: Date | null;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount: number;

  @Column({
    name: 'first_request_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  firstRequestAt: Date;

  @Column({
    name: 'last_request_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  lastRequestAt: Date;

  @Column({ name: 'response_code', type: 'int', nullable: true })
  responseCode?: number | null;
  @Column({ name: 'response_headers', type: 'jsonb', nullable: true })
  responseHeaders?: any | null;
  @Column({ name: 'response_body', type: 'jsonb', nullable: true })
  responseBody?: any | null;

  @Column({ name: 'error_code', type: 'text', nullable: true }) errorCode?:
    | string
    | null;
  @Column({ name: 'error_details', type: 'jsonb', nullable: true })
  errorDetails?: any | null;

  @Column({ name: 'idempotency_window_sec', type: 'int', default: 86400 })
  idempotencyWindowSec: number;

  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
