import { Injectable, Logger, Optional } from '@nestjs/common';
import { DriverAuthGateway } from '../gateways/driver-auth.gateway';
import {
  SessionRefreshedEvent,
  SessionRevokedEvent,
  UserLoggedInEvent,
} from 'src/core/domain/events/auth.events';
import { UserType } from 'src/modules/user/entities/user.entity';

@Injectable()
export class AuthRealtimePublisher {
  private readonly logger = new Logger(AuthRealtimePublisher.name);
  constructor(
    @Optional() private readonly driverGateway?: DriverAuthGateway,
    // @Optional() private readonly passengerGateway?: PassengerGateway, // futuro
  ) {}

  userLoggedIn(ev: UserLoggedInEvent) {
    // En login normalmente NO hay socket del user todavía.
    // Usa un canal de admin o un "global" si tienes uno.
    this.driverGateway?.server?.emit('admin:auth:user_logged_in', {
      userId: ev.userId,
      userType: ev.userType,
      sid: ev.sid,
      sessionType: ev.sessionType,
      at: ev.at,
      deviceInfo: ev.deviceInfo,
    });

    // Si el user ya tuviera sockets (re-login), podrías notificar su room 1:1:
    if (ev.userType === UserType.DRIVER) {
      this.driverGateway?.server
        ?.to(`driver:${ev.userId}`)
        .emit('auth:logged_in', {
          sid: ev.sid,
          at: ev.at,
        });
    }
  }

  sessionRefreshed(ev: SessionRefreshedEvent) {
    // Desconecta sockets unidos a la sesión vieja (oldSid): forzamos reconexión con token nuevo
    this.driverGateway?.server
      ?.to(`session:${ev.oldSid}`)
      .disconnectSockets?.(true);

    // (Opcional) Notifica al driver (si sigue conectado) que hay nueva sesión
    this.driverGateway?.server
      ?.to(`driver:${ev.userId}`)
      .emit('auth:session_refreshed', {
        oldSid: ev.oldSid,
        newSid: ev.newSid,
        at: ev.at,
      });
  }

  sessionRevoked(ev: SessionRevokedEvent) {
    // Desconecta sockets de esa sesión
    this.driverGateway?.server
      ?.to(`session:${ev.sid}`)
      .disconnectSockets?.(true);

    // (Opcional) Notifica al driver (si aún tiene otros sockets)
    this.driverGateway?.server
      ?.to(`driver:${ev.userId}`)
      .emit('auth:session_revoked', {
        sid: ev.sid,
        reason: ev.reason ?? 'revoked',
        at: ev.at,
      });
  }

  // 🔌 cerrar sockets de una sesión
  disconnectSid(sid: string) {
    try {
      this.driverGateway?.server?.to(`session:${sid}`).disconnectSockets(true);
    } catch (e) {
      this.logger.warn(`disconnectSid failed for sid=${sid}`, e);
    }
  }
}
