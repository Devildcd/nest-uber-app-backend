import {
  Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Trip } from '../../trip/entities/trip.entity';
import { DecimalTransformer } from '../../../common/validators/decimal.transformer';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity({ name: 'orders' })
@Unique('uq_orders_trip', ['trip'])
@Index(['status'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Trip, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Index('idx_orders_passenger')
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'passenger_id' })
  passenger: User;

  @Column({
    name: 'requested_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: DecimalTransformer,
  })
  requestedAmount: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  // Integración pasarela
  @Column({ name: 'payment_intent_id', type: 'varchar', length: 100, nullable: true })
  paymentIntentId?: string;

  @Column({ name: 'payment_gateway_response', type: 'jsonb', nullable: true })
  paymentGatewayResponse?: Record<string, any>;

  @Column({ name: 'payment_method_details', type: 'jsonb', nullable: true })
  paymentMethodDetails?: Record<string, any>;

  @Column({ name: 'failure_reason', type: 'varchar', length: 250, nullable: true })
  failureReason?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
