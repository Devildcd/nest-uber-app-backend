import {
  Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { Trip } from '../../trip/entities/trip.entity';
import { User } from '../../user/entities/user.entity';
import { DecimalTransformer } from '../../../common/validators/decimal.transformer';

export enum TransactionType {
  CHARGE = 'charge',
  COMMISSION_DEDUCTION = 'commission_deduction',
  WALLET_TOPUP = 'wallet_topup',
  PAYOUT = 'payout',
  BONUS = 'bonus',
  PENALTY = 'penalty',
  REFUND = 'refund',
  PLAN_PURCHASE = 'plan_purchase',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

@Entity({ name: 'transactions' })
@Index(['type', 'status'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Opcional: puede estar ligada a una orden digital
  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order?: Order | null;

  // Opcional: o a un viaje
  @ManyToOne(() => Trip, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'trip_id' })
  trip?: Trip | null;

  // Flujo de dinero
  @Index('idx_tx_from_user')
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'from_user_id' })
  fromUser?: User | null;

  @Index('idx_tx_to_user')
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'to_user_id' })
  toUser?: User | null;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    name: 'gross_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: DecimalTransformer,
  })
  grossAmount: number;

  @Column({
    name: 'platform_fee_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  platformFeeAmount: number;

  @Column({
    name: 'net_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: DecimalTransformer,
  })
  netAmount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @Column({ type: 'varchar', length: 250, nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}