import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { VehicleType } from '../../vehicle-types/entities/vehicle-types.entity';
/**
 * Entity: VehicleCategory
 * Catálogo base de categorías físicas de vehículos (Automóvil, Motocicleta, Furgoneta, SUV, etc.)
 */
@Entity({ name: 'vehicle_categories' })
export class VehicleCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  iconUrl?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => VehicleType, (vt) => vt.category)
  vehicleTypes?: VehicleType[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt?: Date;
}
