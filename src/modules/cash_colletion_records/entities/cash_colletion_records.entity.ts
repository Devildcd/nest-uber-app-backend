// src/modules/payments/entities/cash-collection-record.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Unique,
} from 'typeorm';
import { CashCollectionPoint } from '../../cash_colletions_points/entities/cash_colletions_points.entity';
import { User } from '../../user/entities/user.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { DecimalTransformer } from '../../../common/validators/decimal.transformer';

export enum CashCollectionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
}

@Entity({ name: 'cash_collection_records' })
@Index(['status'])
@Unique('uq_ccr_transaction', ['transaction'])
export class CashCollectionRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Quién deposita (driver)
  @Index('idx_ccr_driver')
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'driver_id' })
  driver: User;

  // Dónde deposita (punto de recaudo)
  @ManyToOne(() => CashCollectionPoint, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'collection_point_id' })
  collectionPoint: CashCollectionPoint;

  // Quién recibe (staff/operador, usuario del sistema)
  @Index('idx_ccr_collected_by')
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'collected_by_user_id' })
  collectedBy: User;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: DecimalTransformer,
  })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'CUP' })
  currency: string;

  @Column({
    type: 'enum',
    enum: CashCollectionStatus,
    default: CashCollectionStatus.PENDING,
  })
  status: CashCollectionStatus;

  // Enlace directo a la transacción wallet_topup (única)
  @OneToOne(() => Transaction, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'transaction_id' })
  transaction: Transaction;

  @Column({ type: 'varchar', length: 250, nullable: true })
  notes?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
