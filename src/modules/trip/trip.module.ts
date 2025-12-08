import { Module } from '@nestjs/common';
import { Trip } from './entities/trip.entity';
import { User } from '../user/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { TripRepository } from './repositories/trip.repository';
import { TripService } from './services/trip.service';
import { TripController } from './controllers/trip.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripEvent } from './entities/trip-event.entity';
import { TripStop } from './entities/trip-stop.entity';
import { TripAssignment } from './entities/trip-assignment.entity';
import { TripEventsRepository } from './repositories/trip-events.repository';
import { TripStopsRepository } from './repositories/trip-stops.repository';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CoreSettingsModule } from '../core-settings/core-settings.module';
import { TripHelpersService } from './services/trip-helpers.service';
import { TripAssignmentRepository } from './repositories/trip-assignment.repository';
import { MatchingDomainGuards } from './domain/matching-domain-guards';
import { DriversAvailabilityModule } from '../drivers-availability/drivers-availability.module';
import { TripSnapshot } from './entities/trip-snapshot.entity';
import { TripSnapshotRepository } from './repositories/trip-snapshot.repository';
import { OrdersModule } from '../orders/orders.module';
import { AssignmentExpiryScheduler } from './services/assignment-expiry.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Trip,
      User,
      Order,
      TripAssignment,
      TripEvent,
      TripStop,
      TripSnapshot,
    ]),
    EventEmitterModule,
    CoreSettingsModule,
    DriversAvailabilityModule,
    OrdersModule,
  ],
  controllers: [TripController],
  providers: [
    TripService,
    TripRepository,
    TripEventsRepository,
    TripStopsRepository,
    TripAssignmentRepository,
    TripHelpersService,
    MatchingDomainGuards,
    TripSnapshotRepository,
    AssignmentExpiryScheduler,
  ],
  exports: [TripRepository, TripService, AssignmentExpiryScheduler],
})
export class TripModule {}
