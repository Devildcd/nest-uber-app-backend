import { User } from 'src/modules/user/entities/user.entity';
import { SavedLocation } from '../../location/entities/saved_location.entity';
import { VehicleType } from 'src/modules/vehicles/entities/vehicle.entity';
import { TripEvent } from '../../trip/entities/trip_events.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';

export enum TripStatus {
  PENDING = 'pending',
  ASSIGNING = 'assigning',
  DRIVER_REJECTED = 'driver_rejected',
  NO_DRIVERS_FOUND = 'no_drivers_found',
  ACCEPTED = 'accepted',
  ARRIVING = 'arriving',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'trips' })
@Index('idx_trips_passenger', ['passenger'])
@Index('idx_trips_driver', ['driver'])
@Index('idx_trips_status', ['status'])
@Index('idx_trips_created_at', ['createdAt'])
@Index('idx_trips_origin_point', ['originLocation'], { spatial: true })
@Index('idx_trips_dest_point', ['destLocation'], { spatial: true })

export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.requestedTrips, { 
    nullable: false,
    onDelete: 'RESTRICT', 
  })
  passenger: User;

  @ManyToOne(() => User, (user) => user.assignedTrips, { 
    nullable: true,
    onDelete: 'SET NULL', })
  driver?: User;

  @OneToMany(()=>TripEvent,(event)=>event.trip,{
    cascade: true
  })
  events: TripEvent[];

  @Column({ type: 'enum', enum: TripStatus })
  status: TripStatus;

  @Column('geography', {
    spatialFeatureType: 'Point',
    srid: 4326,
    name: 'origin_location',
  })
  originLocation: string;

  @Column({ type: 'varchar', name: 'origin_address_text' })
  originAddressText: string;

  @Column('geography', {
    spatialFeatureType: 'Point',
    srid: 4326,
    name: 'dest_location',
  })
  destination_location : string;

  @Column({ type: 'varchar', name: 'dest_address_text' })
  destination_address_text : string;

  @ManyToOne(() => SavedLocation, { nullable: true })
  pickupLocation?: SavedLocation;

  @ManyToOne(() => SavedLocation, { nullable: true })
  dropoffLocation?: SavedLocation;

  @Column({ type: 'decimal', name: 'estimated_distance_km' })
  estimatedDistanceKm: number;

  @Column({ type: 'numeric', name: 'estimated_cost' })
  estimatedCost: string;

  @Column({ type: 'numeric', name: 'actual_cost', nullable: true })
  actualCost?: string;

  @Column({ type: 'jsonb', name: 'fare_breakdown' })
  fareBreakdown: Record<string, any>;

  @Column({ type: 'timestamp', name: 'pickup_time_estimate', nullable: true })
  pickupTimeEstimate?: Date;

  @Column({ type: 'timestamp', name: 'dropoff_time_estimate', nullable: true })
  dropoffTimeEstimate?: Date;

  @Column({ type: 'timestamp', name: 'trip_start_time', nullable: true })
  tripStartTime?: Date;

  @Column({ type: 'timestamp', name: 'trip_end_time', nullable: true })
  tripEndTime?: Date;

  @Column({ type: 'enum', enum: VehicleType, name: 'vehicle_type_requested' })
  vehicleTypeRequested: VehicleType;

  @Column({ type: 'enum', enum: VehicleType, name: 'vehicle_type_assigned', nullable: true })
  vehicleTypeAssigned?: VehicleType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'jsonb', name: 'priority_snapshot' })
  prioritySnapshot: Record<string, any>;

  /* @ManyToOne(() => UserPlan, { nullable: true })
  @JoinColumn({ name: 'free_plan_id' })
  freePlan?: UserPlan;

  @ManyToOne(() => UserPlan, { nullable: true })
  @JoinColumn({ name: 'prepaid_plan_id' })
  prepaidPlan?: UserPlan;

  @ManyToOne(() => UserIncentive, { nullable: true })
  @JoinColumn({ name: 'incentive_id' })
  incentive?: UserIncentive;

  @ManyToOne(() => PaymentMethod, { nullable: true })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod?: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentMethodType, name: 'payment_method_type' })
  paymentMethodType: PaymentMethodType;
*/
}

  