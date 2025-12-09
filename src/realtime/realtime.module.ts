import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UserModule } from 'src/modules/user/user.module';
import { DriverAuthGateway } from './gateways/driver-auth.gateway';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { DriversAvailabilityModule } from 'src/modules/drivers-availability/drivers-availability.module';
import { AuthRealtimePublisher } from './publishers/auth-realtime.publisher';
import { AuthEventsListener } from './listeners/auth-events.listener';
import { DriverAvailabilityGateway } from './gateways/driver-availability.gateway';
import { DriverAvailabilityRealtimePublisher } from './publishers/driver-availability-realtime.publisher';
import { DriverAvailabilityEventsListener } from './listeners/driver-availability.events.listener';
import { AuthToAvailabilityListener } from './listeners/auth-availability.listener';
import { AdminGateway } from './gateways/admin.gateway';
import { PassengerGateway } from './gateways/passenger.gateway';
import { TripRealtimePublisher } from './publishers/trip-realtime.publisher';
import { TripEventsListener } from './listeners/trip-events.listener';
import { TripModule } from 'src/modules/trip/trip.module';
import { TripAssigningOrchestrator } from './orchestrators/trip-assigning.orchestrator';
import { DriverAssignedAutoArrivingOrchestrator } from './orchestrators/driver-assigned-auto-arriving.orchestrator';
import { AssignmentExpiryListener } from './listeners/assignment-expiry.listener';
import { WsCoreModule } from 'src/core/ws/ws-core.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    DriversAvailabilityModule,
    TripModule,
    WsCoreModule,
  ],
  providers: [
    DriverAuthGateway,
    WsJwtGuard,
    AuthRealtimePublisher,
    AuthEventsListener,
    DriverAvailabilityGateway,
    DriverAvailabilityRealtimePublisher,
    DriverAvailabilityEventsListener,
    AuthToAvailabilityListener,
    AdminGateway,
    PassengerGateway,
    TripRealtimePublisher,
    TripEventsListener,
    TripAssigningOrchestrator,
    DriverAssignedAutoArrivingOrchestrator,
    AssignmentExpiryListener,
  ],
  exports: [
    TripRealtimePublisher,
    PassengerGateway,
    DriverAvailabilityGateway,
    AdminGateway,
  ],
})
export class RealtimeModule {}
