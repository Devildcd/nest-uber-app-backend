import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  ManyToOne,
  JoinColumn,
  Index,
  UpdateDateColumn,
  DeleteDateColumn,
  Check,
} from 'typeorm';
import { Point } from 'geojson';
import { User } from 'src/modules/user/entities/user.entity';
import { Trip } from 'src/modules/trip/entities/trip.entity';
import { Vehicle } from 'src/modules/vehicles/entities/vehicle.entity';

export enum AvailabilityReason {
  OFFLINE = 'OFFLINE',
  ON_TRIP = 'ON_TRIP',
  UNAVAILABLE = 'UNAVAILABLE',
}

@Entity({ name: 'drivers_availability' })
/** ───────── Consistencia de flags/razón ───────── */

/* disponible ⇒ online, sin trip y sin razón */
@Check(
  `(NOT "is_available_for_trips") OR ("is_online" = true AND "current_trip_id" IS NULL AND "availability_reason" IS NULL)`,
)
/* si hay trip ⇒ no disponible y razón ON_TRIP */
@Check(`("current_trip_id" IS NULL) OR ("is_available_for_trips" = false)`)
@Check(`("current_trip_id" IS NULL) OR ("availability_reason" = 'ON_TRIP')`)
/* ON_TRIP ⇒ requiere trip */
@Check(
  `("availability_reason" IS DISTINCT FROM 'ON_TRIP') OR ("current_trip_id" IS NOT NULL)`,
)
/* UNAVAILABLE ⇒ no disponible */
@Check(
  `("availability_reason" IS DISTINCT FROM 'UNAVAILABLE') OR ("is_available_for_trips" = false)`,
)
/* OFFLINE (simetría) — salvo que esté en trip, offline ⇔ razón OFFLINE */
@Check(
  `("current_trip_id" IS NOT NULL) OR ((NOT "is_online") = ("availability_reason" = 'OFFLINE'))`,
)
/** ───────── Unicidades / filtros frecuentes ───────── */
@Index('uq_drv_av_driver_active', ['driverId'], {
  unique: true,
  where: `"deleted_at" IS NULL`,
})
@Index('uq_drv_av_trip_active', ['currentTripId'], {
  unique: true,
  where: `"current_trip_id" IS NOT NULL AND "deleted_at" IS NULL`,
})
@Index('idx_drv_av_online', ['isOnline'], { where: `"deleted_at" IS NULL` })
@Index('idx_drv_av_available', ['isAvailableForTrips'], {
  where: `"deleted_at" IS NULL`,
})
@Index('idx_drv_av_online_available', ['isOnline', 'isAvailableForTrips'], {
  where: `"deleted_at" IS NULL`,
})
@Index('idx_drv_av_last_presence_ts', ['lastPresenceTimestamp'], {
  where: `"deleted_at" IS NULL`,
})
/* matcheable: acelera nearby/matching (parcial) */
@Index('idx_drv_av_matchable', ['isOnline', 'isAvailableForTrips'], {
  where: `"is_online" = true AND "is_available_for_trips" = true AND "availability_reason" IS NULL AND "deleted_at" IS NULL`,
})
export class DriverAvailability {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id!: string;

  @Column('uuid', { name: 'driver_id' })
  driverId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver!: User;

  @Column('boolean', { name: 'is_online', default: false })
  isOnline!: boolean;

  @Column('boolean', { name: 'is_available_for_trips', default: false })
  isAvailableForTrips!: boolean;

  /* SUGERENCIA: crear GIST por migración:
     CREATE INDEX IF NOT EXISTS idx_drv_av_last_location_gix
       ON drivers_availability USING GIST(last_location);
     (si usas @Index({ spatial:true }) sincronizando, valida en tu stack) */
  @Column({
    name: 'last_location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  lastLocation?: Point | null;

  @Column('timestamptz', { name: 'last_location_timestamp', nullable: true })
  lastLocationTimestamp?: Date | null;

  @Column('uuid', { name: 'current_trip_id', nullable: true })
  currentTripId?: string | null;

  @OneToOne(() => Trip, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'current_trip_id' })
  currentTrip?: Trip | null;

  @Column('uuid', { name: 'current_vehicle_id', nullable: true })
  currentVehicleId?: string | null;

  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'current_vehicle_id' })
  currentVehicle?: Vehicle | null;

  @Column('timestamptz', { name: 'last_online_timestamp', nullable: true })
  lastOnlineTimestamp?: Date | null;

  @Column('timestamptz', { name: 'last_presence_timestamp', nullable: true })
  lastPresenceTimestamp?: Date | null;

  @Column('enum', {
    name: 'availability_reason',
    enum: AvailabilityReason,
    nullable: true,
    default: null,
  })
  availabilityReason?: AvailabilityReason | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
