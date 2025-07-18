import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/modules/user/entities/user.entity';

export enum LocationType {
  HOME = 'home',
  WORK = 'work',
  OTHER = 'other',
  AIRPORT = 'airport',
  HOTEL = 'hotel',
  RESTAURANT = 'restaurant',
  SCHOOL = 'school'
}

@Index('idx_locations_user_id', ['user'])
@Index('idx_locations_coordinates', ['coordinates'], { spatial: true })
@Entity({ name: 'locations' })
export class SavedLocation {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  @ManyToOne(() => User, (user) => user.sa, { 
    nullable: true,
    onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', nullable: true })
  name?: string;

  @Column({ type: 'varchar', name: 'address_text' })
  addressText: string;

  @Column('geography', {
    spatialFeatureType: 'Point',
    srid: 4326,
    name: 'coordinates',
  })
  coordinates: string;

  @Column({ type: 'boolean', name: 'is_favorite', default: false })
  isFavorite: boolean;

  @Column({ type: 'enum', enum: LocationType, nullable: true })
  type?: LocationType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}