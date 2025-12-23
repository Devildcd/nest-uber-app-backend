import {
  Entity,
  Column,
  Index,
  Unique,
  Check,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { MultiPolygon } from 'geojson';
import { City } from '../../cities/entities/city.entity';
import { PricePolicy } from '../../price-policies/entities/price-policy.entity';
import { AppBaseEntity } from 'src/database/base.entity';

@Entity({ name: 'zone' })
@Index('idx_zone_city', ['cityId'])
@Index('idx_zone_name', ['name'])
@Index('idx_zone_priority', ['priority'])
@Index('idx_zone_geom', ['geom'], { spatial: true })
@Index('idx_zone_active', ['active'])
@Unique('uq_zone_city_name', ['cityId', 'name'])
@Check('ck_zone_priority_gte_0', `"priority" >= 0`)
@Check(
  'ck_zone_geom_valid_srid_4326',
  `ST_SRID("geom") = 4326 AND ST_IsValid("geom")`,
)
export class Zone extends AppBaseEntity {
  @Column({ type: 'uuid' })
  cityId!: string;

  @ManyToOne(() => City, (c) => c.zones, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cityId' })
  city!: City;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  kind!: string | null;

  @Column({ type: 'int', default: 100 })
  priority!: number;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'MultiPolygon',
    srid: 4326,
    nullable: false,
  })
  geom!: MultiPolygon;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  // Relations (si la necesitas)
  @OneToMany(() => PricePolicy, (p) => p.zone)
  pricePolicies!: PricePolicy[];
}
