import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PrepaidPlan } from './prepaid-plans.entity';
import { User } from 'src/modules/user/entities/user.entity';

export enum UserPrepaidPlanStatus {
  ACTIVE = 'active',
  USED = 'used',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

// Índices
@Index('idx_upplans_user', ['userId'])
@Index('idx_upplans_user_status_exp', ['userId', 'status', 'expirationDate'])
@Index('idx_upplans_status_trips', ['status', 'tripsRemaining'])
@Entity({ name: 'user_prepaid_plans' })
export class UserPrepaidPlan {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' }) 
  user?: User;

  @Column({ name: 'plan_id', type: 'uuid', nullable: false })
  planId!: string;

  // Relación opcional al catálogo (no obliga a cargarla)
  @ManyToOne(() => PrepaidPlan, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id', referencedColumnName: 'id' })
  plan?: PrepaidPlan;

  @CreateDateColumn({
    name: 'purchase_date',
    type: 'timestamp',
    default: () => 'NOW()',
  })
  purchaseDate!: Date;

  @Column({ name: 'expiration_date', type: 'timestamp', nullable: true })
  expirationDate?: Date | null;

  @Column({ name: 'trips_remaining', type: 'int', nullable: true })
  tripsRemaining?: number | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: UserPrepaidPlanStatus,
    default: UserPrepaidPlanStatus.ACTIVE,
  })
  status!: UserPrepaidPlanStatus;

  @Column({
    name: 'initial_purchase_transaction_id',
    type: 'uuid',
    nullable: true,
  })
  initialPurchaseTransactionId?: string | null;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt?: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'NOW()',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'NOW()',
  })
  updatedAt!: Date;
}

