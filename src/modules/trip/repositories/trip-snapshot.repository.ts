// src/modules/trip/repositories/trip-snapshot.repository.ts
import { Injectable } from '@nestjs/common';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { DataSource, EntityManager } from 'typeorm';
import { TripSnapshot } from '../entities/trip-snapshot.entity';

@Injectable()
export class TripSnapshotRepository extends BaseRepository<TripSnapshot> {
  constructor(ds: DataSource) {
    super(
      TripSnapshot,
      ds.createEntityManager(),
      'TripSnapshotRepository',
      'TripSnapshot',
    );
  }

  async upsertForTrip(
    p: {
      tripId: string;
      driverName: string;
      driverPhone?: string | null;
      vehicleMake: string;
      vehicleModel: string;
      vehicleColor?: string | null;
      vehiclePlate: string;
      serviceClassName: string;
    },
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    // usa ON CONFLICT (trip_id) DO UPDATE para idempotencia
    await repo
      .createQueryBuilder()
      .insert()
      .into(TripSnapshot)
      .values({
        tripId: p.tripId,
        driverName: p.driverName,
        driverPhone: p.driverPhone ?? null,
        vehicleMake: p.vehicleMake,
        vehicleModel: p.vehicleModel,
        vehicleColor: p.vehicleColor ?? null,
        vehiclePlate: p.vehiclePlate,
        serviceClassName: p.serviceClassName,
        capturedAt: () => 'now()',
      } as any)
      .orUpdate(
        [
          'driver_name',
          'driver_phone',
          'vehicle_make',
          'vehicle_model',
          'vehicle_color',
          'vehicle_plate',
          'service_class_name',
          'captured_at',
        ],
        ['trip_id'],
      )
      .execute();
  }
}
