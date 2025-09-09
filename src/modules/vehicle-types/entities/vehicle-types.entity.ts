import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  DeleteDateColumn,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { VehicleCategory } from '../../vehicle-category/entities/vehicle-category.entity';
import { VehicleServiceClass } from '../../vehicle-service-classes/entities/vehicle-service-classes.entity';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';

@Entity('vehicle_types')
export class VehicleType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => VehicleCategory, (category) => category.vehicleTypes, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'category_id' })
  category: VehicleCategory;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'base_fare', type: 'numeric', precision: 10, scale: 2 })
  baseFare: number;

  @Column({ name: 'cost_per_km', type: 'numeric', precision: 10, scale: 4 })
  costPerKm: number;

  @Column({ name: 'cost_per_minute', type: 'numeric', precision: 10, scale: 4 })
  costPerMinute: number;

  @Column({ name: 'min_fare', type: 'numeric', precision: 10, scale: 2 })
  minFare: number;

  @Column({ name: 'default_capacity', type: 'int' })
  defaultCapacity: number;

  @Column({ name: 'icon_url', type: 'varchar', nullable: true })
  iconUrl?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ManyToMany(
    () => VehicleServiceClass,
    (serviceClass) => serviceClass.vehicleTypes,
  )
  @JoinTable({
    name: 'vehicle_type_service_classes', // tabla pivote
    joinColumn: { name: 'vehicle_type_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'service_class_id', referencedColumnName: 'id' },
  })
  serviceClasses: VehicleServiceClass[];

  @OneToMany(() => Vehicle, (v) => v.vehicleType)
  vehicles?: Vehicle[];

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamptz',
  })
  deletedAt?: Date;
}
