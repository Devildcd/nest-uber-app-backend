import {
  Entity,
  Column,
  Index,
  Unique,
  Check,
  OneToMany,
  MultiPolygon,
} from 'typeorm';
import { AppBaseEntity } from 'src/database/base.entity';
import { Zone } from '../../zones/entities/zone.entity';
import { PricePolicy } from '../../price-policies/entities/price-policy.entity';

@Entity({ name: 'city' })
@Index('idx_city_name', ['name'])
@Index('idx_city_country', ['countryCode'])
@Index('idx_city_active', ['active'])
@Index('idx_city_geom', ['geom'], { spatial: true })
@Unique('uq_city_name_country', ['name', 'countryCode'])
@Check('ck_city_country_code_iso2', `"countryCode" ~ '^[A-Z]{2}$'`)
@Check(
  'ck_city_geom_valid_srid_4326',
  `"geom" IS NULL OR (ST_SRID("geom") = 4326 AND ST_IsValid("geom"))`,
)
export class City extends AppBaseEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'char', length: 2 })
  countryCode!: string; // ISO-3166-1 alpha-2 (MX, CO, AR, ...)

  @Column({ type: 'text' })
  timezone!: string; // IANA, ej: America/Mexico_City

  @Column({
    type: 'geometry',
    spatialFeatureType: 'MultiPolygon',
    srid: 4326,
    nullable: true,
  })
  geom!: MultiPolygon | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  // Relations
  @OneToMany(() => Zone, (z) => z.city)
  zones!: Zone[];

  @OneToMany(() => PricePolicy, (p) => p.city)
  pricePolicies!: PricePolicy[];
}
