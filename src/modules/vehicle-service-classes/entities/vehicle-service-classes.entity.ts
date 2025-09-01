import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToMany,
} from 'typeorm';
import { VehicleType } from '../../vehicle-types/entities/vehicle-types.entity';
/**
 * Entity: VehicleServiceClass
 * Catálogo de clases/calificaciones de servicio que ofrece la plataforma
 * Ejemplos: Economy, Standard, Premium, XL, Luxury
 */
@Entity({ name: 'vehicle_service_classes' })
export class VehicleServiceClass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 1.0 })
  baseFareMultiplier: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 1.0 })
  costPerKmMultiplier: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 1.0 })
  costPerMinuteMultiplier: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 1.0 })
  minFareMultiplier: number;

  @Column({ type: 'int', nullable: false })
  minCapacity: number;

  @Column({ type: 'int', nullable: false })
  maxCapacity: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  iconUrl?: string;

  @Column({ type: 'int', default: 1 })
  displayOrder?: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToMany(() => VehicleType, (vehicleType) => vehicleType.serviceClasses)
  vehicleTypes: VehicleType[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt?: Date;
}
