import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { DriverBalance } from './driver_balance.entity';
import { DecimalTransformer } from 'src/common/validators/decimal.transformer';

@Entity({ name: 'wallet_movements' })
export class WalletMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid', { name: 'wallet_id' })
  walletId: string;

  @ManyToOne(() => DriverBalance, (w) => w.movements, { onDelete: 'CASCADE' })
  wallet: DriverBalance;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId?: string | null; // link a tabla transactions

  // use cents or numeric depending diseño
  @Column({
    name: 'amount',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  amount: number;

  @Column({
    name: 'previous_balance',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  previousBalance: number;

  @Column({
    name: 'new_balance',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  newBalance: number;

  @Column({ name: 'note', type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
