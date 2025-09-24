import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'outbox_events' })
@Index(['status', 'createdAt'])
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 }) // e.g. 'trip.requested'
  type!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  @Column({ type: 'varchar', length: 20, default: 'pending' }) // pending|sent|failed
  status!: 'pending' | 'sent' | 'failed';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date;

  @Column({ name: 'fail_reason', type: 'text', nullable: true })
  failReason?: string;
}
