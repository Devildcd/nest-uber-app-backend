import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
  Index,
  RelationId,
} from 'typeorm';
import { Order } from './order.entity';
import { DecimalTransformer } from 'src/common/validators/decimal.transformer';

@Entity({ name: 'commission_adjustments' })
@Unique('uq_comm_adj_order_seq', ['orderId', 'adjustmentSeq'])
export class CommissionAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // relación al pedido (order). ON DELETE CASCADE para limpiar ajustes si se borra el pedido.
  @ManyToOne(() => Order, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  @Index('idx_comm_adj_order')
  order: Order;

  // RelationId facilita consultas/índices sin cargar la entidad order completa
  @RelationId((adj: CommissionAdjustment) => adj.order)
  orderId: string;

  // secuencia / token de idempotencia (máx 60 chars)
  @Column({ name: 'adjustment_seq', type: 'varchar', length: 60 })
  @Index('idx_comm_adj_order_seq')
  adjustmentSeq: string;

  // Delta aplicado: positivo => la plataforma cobra más comisión (penaliza al driver);
  // negativo => la plataforma devuelve comisión (bonifica al driver).
  @Column({
    name: 'delta_fee',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: DecimalTransformer,
  })
  deltaFee: number;

  // Snapshot para auditoría (comisión original registrada)
  @Column({
    name: 'original_fee',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: DecimalTransformer,
  })
  originalFee: number;

  // Snapshot de la comisión resultante después de aplicar delta
  @Column({
    name: 'new_fee',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: DecimalTransformer,
  })
  newFee: number;

  @Column({ name: 'reason', type: 'varchar', length: 200, nullable: true })
  reason?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
