import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'trip_snapshots' })
export class TripSnapshot {
  @PrimaryColumn('uuid', { name: 'trip_id' })
  tripId: string;

  @Column('text', { name: 'driver_name' })
  driverName: string;

  @Column('text', { name: 'driver_phone', nullable: true })
  driverPhone?: string | null;

  @Column('text', { name: 'vehicle_make' })
  vehicleMake: string;

  @Column('text', { name: 'vehicle_model' })
  vehicleModel: string;

  @Column('text', { name: 'vehicle_color', nullable: true })
  vehicleColor?: string | null;

  @Column('text', { name: 'vehicle_plate' })
  vehiclePlate: string;

  @Column('text', { name: 'service_class_name' })
  serviceClassName: string;

  @Column('timestamptz', { name: 'captured_at' })
  capturedAt: Date;
}
