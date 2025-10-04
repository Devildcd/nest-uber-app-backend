import { Injectable, Logger } from '@nestjs/common';
import { AuthRealtimePublisher } from '../publishers/auth-realtime.publisher';
import { OnEvent } from '@nestjs/event-emitter';
import { DriverAvailabilityService } from 'src/modules/drivers-availability/services/driver-availability.service';
import {
  AuthEvents,
  SessionRefreshedEvent,
  SessionRevokedEvent,
  UserLoggedInEvent,
} from 'src/core/domain/events/auth.events';

@Injectable()
export class AuthEventsListener {
  private readonly logger = new Logger(AuthEventsListener.name);
  constructor(
    private readonly publisher: AuthRealtimePublisher,
    private readonly driverAvailabilityService: DriverAvailabilityService,
  ) {}

  @OnEvent(AuthEvents.UserLoggedIn, { async: true })
  async onUserLoggedIn(ev: UserLoggedInEvent) {
    this.publisher.userLoggedIn(ev);
  }

  @OnEvent(AuthEvents.SessionRefreshed, { async: true })
  async onSessionRefreshed(ev: SessionRefreshedEvent) {
    this.publisher.sessionRefreshed(ev);
  }

  @OnEvent(AuthEvents.SessionRevoked)
  async onSessionRevoked(p: SessionRevokedEvent) {
    // 1) cortar sockets de esa sesión
    this.publisher.disconnectSid(p.sid);

    // 2) notificar por WS
    this.publisher.sessionRevoked(p);

    // 3) (opcional) bajar disponibilidad inmediata si es logout explícito
    if (p.reason === 'user_logout') {
      try {
        await this.driverAvailabilityService.updateStatus(p.userId, {
          isOnline: false,
          isAvailableForTrips: false,
        });
      } catch (e) {
        this.logger.warn(
          `Failed to degrade availability on logout user=${p.userId}`,
          e,
        );
      }
    }
  }
}
