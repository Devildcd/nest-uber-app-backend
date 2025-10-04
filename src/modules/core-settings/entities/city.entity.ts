import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
  Unique,
} from 'typeorm';

@Entity({ name: 'city' })
@Unique('uq_city_name_country', ['name', 'countryCode'])
@Check(`"countryCode" ~ '^[A-Z]{2}$'`)
export class City {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_city_name')
  @Column({ type: 'text' })
  name!: string;

  @Index('idx_city_country')
  @Column({ type: 'char', length: 2 })
  countryCode!: string; // ISO-3166-1 alpha-2

  @Column({ type: 'text' })
  timezone!: string; // p.ej. "America/Mexico_City"

  // MULTIPOLYGON SRID 4326 (opcional si no quieres límites de ciudad)
  @Column({
    type: 'geometry',
    spatialFeatureType: 'MultiPolygon',
    srid: 4326,
    nullable: true,
  })
  geom?: string | null;

  @Index('idx_city_active')
  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
