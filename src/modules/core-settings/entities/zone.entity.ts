import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
  Unique,
} from 'typeorm';
import { City } from './city.entity';

@Entity({ name: 'zone' })
@Unique('uq_zone_city_name', ['cityId', 'name'])
@Check(`"priority" >= 0`)
export class Zone {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_zone_city')
  @Column({ type: 'uuid' })
  cityId!: string;

  @ManyToOne(() => City, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cityId' })
  city!: City;

  @Index('idx_zone_name')
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  kind?: string | null; // "aeropuerto", "centro", etc.

  @Index('idx_zone_priority')
  @Column({ type: 'int', default: 100 })
  priority!: number;

  // MULTIPOLYGON SRID 4326 obligatorio
  @Column({
    type: 'geometry',
    spatialFeatureType: 'MultiPolygon',
    srid: 4326,
  })
  geom!: string;

  @Index('idx_zone_active')
  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
