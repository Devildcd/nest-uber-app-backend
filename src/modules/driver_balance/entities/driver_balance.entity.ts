import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { DecimalTransformer } from '../../../common/validators/decimal.transformer';
import { WalletMovement } from '../../wallet-m../../wallet-movements/entities/wallet-movement.entity';

@Entity({ name: 'driver_balance' })
export class DriverBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: User;

  @Index('uq_driver_balance_driver', { unique: true })
  @Column('uuid', { name: 'driver_id', unique: true })
  driverId: string;

  @Column({
    name: 'current_wallet_balance',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  currentWalletBalance: number;

  // Montos retenidos (preautorizaciones, disputas)
  @Column({
    name: 'held_wallet_balance',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  heldWalletBalance: number;

  @Column({
    name: 'total_earned_from_trips',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  totalEarnedFromTrips: number;

  @Column({ type: 'varchar', length: 3, default: 'CUP' })
  currency: string;

  @Column({ name: 'last_payout_at', type: 'timestamptz', nullable: true })
  lastPayoutAt?: Date;

  @Column({
    name: 'min_payout_threshold',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  minPayoutThreshold: number;

  @Column({ name: 'payout_method_id', type: 'uuid', nullable: true })
  payoutMethodId?: string | null;

  // status para bloquear wallet si es necesario (fraude, reclamo)
  @Column({ name: 'status', type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'blocked';

  @Column({ name: 'last_updated', type: 'timestamptz', default: () => 'NOW()' })
  lastUpdated: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // movimientos para trazabilidad
  @OneToMany(() => WalletMovement, (m) => m.wallet)
  movements: WalletMovement[];
}
