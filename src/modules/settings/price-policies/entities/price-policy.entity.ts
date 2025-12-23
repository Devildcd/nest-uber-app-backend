import { AppBaseEntity } from 'src/database/base.entity';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { City } from '../../cities/entities/city.entity';
import { Zone } from '../../zones/entities/zone.entity';

export enum PricePolicyScopeType {
  GLOBAL = 'GLOBAL',
  CITY = 'CITY',
  ZONE = 'ZONE',
}

export type PricePolicyConditions = {
  days_of_week?: number[]; // 1..7
  time_ranges?: { start: string; end: string }[]; // HH:MM
  dates?: string[]; // YYYY-MM-DD
  date_ranges?: { from: string; to: string }[];
  exclude_dates?: string[];
};

export type PricePolicyPrice = {
  base_fare?: number;
  per_km?: number;
  per_minute?: number;
  minimum_fare?: number;
  booking_fee?: number;
  night_surcharge?: number;
  cap?: number;
};

@Entity({ name: 'price_policy' })
@Index('idx_price_policy_scope', ['scopeType'])
@Index('idx_price_policy_city', ['cityId'])
@Index('idx_price_policy_zone', ['zoneId'])
@Index('idx_price_policy_active', ['active'])
@Index('idx_price_policy_priority', ['priority'])
@Index('idx_price_policy_effective', ['effectiveFrom', 'effectiveTo'])
@Check('ck_price_policy_priority_gte_0', `"priority" >= 0`)
@Check(
  'ck_price_policy_effective_window',
  `"effectiveTo" IS NULL OR "effectiveFrom" IS NULL OR "effectiveTo" > "effectiveFrom"`,
)
@Check(
  'ck_price_policy_scope_coherence',
  `(
    ("scopeType" = 'GLOBAL' AND "cityId" IS NULL AND "zoneId" IS NULL) OR
    ("scopeType" = 'CITY'   AND "cityId" IS NOT NULL AND "zoneId" IS NULL) OR
    ("scopeType" = 'ZONE'   AND "zoneId" IS NOT NULL AND "cityId" IS NULL)
  )`,
)
export class PricePolicy extends AppBaseEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'enum', enum: PricePolicyScopeType })
  scopeType!: PricePolicyScopeType;

  @Column({ type: 'uuid', nullable: true })
  cityId!: string | null;

  @ManyToOne(() => City, (c) => c.pricePolicies, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'cityId' })
  city!: City | null;

  @Column({ type: 'uuid', nullable: true })
  zoneId!: string | null;

  @ManyToOne(() => Zone, (z) => z.pricePolicies, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'zoneId' })
  zone!: Zone | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'int', default: 100 })
  priority!: number;

  @Column({ type: 'timestamptz', nullable: true })
  effectiveFrom!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  effectiveTo!: Date | null;

  @Column({ type: 'text', default: 'UTC' })
  timezone!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  conditions!: PricePolicyConditions;

  @Column({ type: 'jsonb' })
  price!: PricePolicyPrice;

  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;
}
