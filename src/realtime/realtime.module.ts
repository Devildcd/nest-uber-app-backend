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

@Module({
  imports: [AuthModule, UserModule, DriversAvailabilityModule, TripModule],
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
  ],
  exports: [PassengerGateway, TripRealtimePublisher],
})
export class RealtimeModule {}
