import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Trip } from './trip.entity';
import { User } from '../../user/entities/user.entity';
import { ITripEventMetadata} from '../interfaces/trip-event-metadata.interface';

export enum TripEventType {
  TRIP_REQUESTED = 'trip_requested',
  DRIVER_ASSIGNED = 'driver_assigned',
  DRIVER_ACCEPTED = 'driver_accepted',
  DRIVER_ARRIVING = 'driver_arriving',
  TRIP_STARTED = 'trip_started',
  TRIP_COMPLETED = 'trip_completed',
  CANCELLED = 'cancelled',
  DRIVER_REJECTED = 'driver_rejected',
  NO_DRIVER_FOUND = 'no_driver_found',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_CONFIRMED = 'payment_confirmed',
  DRIVER_LOCATION_UPDATE = 'driver_location_update',
  FARE_ADJUSTED = 'fare_adjusted',
    
}

export enum EventSource {
  PASSENGER_APP = 'passenger_app',
  DRIVER_APP = 'driver_app',
  ADMIN_PANEL = 'admin_panel',
  SYSTEM_CRON = 'system_cron',
  EXTERNAL_API = 'external_api',
}

@Index('idx_trip_events_trip_id', ['trip'])
@Index('idx_trip_events_event_type', ['eventType'])
@Index('idx_trip_events_timestamp', ['timestamp'])
@Entity({ name: 'trip_events' })
export class TripEvent {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  @ManyToOne(() => Trip,(trip)=>trip.events,{ 
    nullable: false, 
    onDelete: 'CASCADE' })
   trip: Trip;

  @Column({ type: 'enum', enum: TripEventType, name: 'event_type' })
  eventType: TripEventType;

  @ManyToOne(() => User, { 
    nullable: true, 
    onDelete: 'SET NULL' })
   actor?: User;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'jsonb', name: 'metadata', default: {} })
  metadata: ITripEventMetadata;

  @Column({ type: 'enum', enum: EventSource, name: 'event_source' })
  eventSource: EventSource;
}