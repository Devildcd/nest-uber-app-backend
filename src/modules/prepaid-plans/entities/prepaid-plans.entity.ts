import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Index('idx_prepaid_plans_active', ['isActive'])
@Index('idx_prepaid_plans_active_currency', ['isActive', 'currency'])
@Entity({ name: 'prepaid_plans' })
export class PrepaidPlan {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id!: string;

  @Column({ name: 'name', type: 'varchar', nullable: false })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string | null;

  //Número de viajes incluidos en el plan (si aplica)
  @Column({ name: 'trips_included', type: 'int', nullable: true })
  tripsIncluded?: number | null;

  //Porcentaje de descuento que ofrece el plan.  
  @Column({
    name: 'discount_pct',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  discountPct?: string | null; // usar string para decimal en TypeORM

  //Un monto de descuento fijo que el plan aplica.
  @Column({
    name: 'fixed_discount_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  fixedDiscountAmount?: string | null;

  //Número de días que el plan es válido.
  @Column({ name: 'expires_in_days', type: 'int', nullable: true })
  expiresInDays?: number | null;

  @Column({
    name: 'price',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: false,
  })
  price!: string;

  @Column({ name: 'currency', type: 'varchar', nullable: false })
  currency!: string;

  @Column({ name: 'is_active', type: 'boolean', default: () => 'true' })
  isActive!: boolean;

  @Column({ name: 'plan_features', type: 'jsonb', nullable: true })
  planFeatures?: Record<string, any> | null;

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

