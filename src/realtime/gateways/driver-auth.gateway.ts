import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TokenService } from 'src/modules/auth/services/token.service';
import { SessionRepository } from 'src/modules/auth/repositories/session.repository';
import { UserRepository } from 'src/modules/user/repositories/user.repository';
import { UserStatus, UserType } from 'src/modules/user/entities/user.entity';

@WebSocketGateway({ namespace: '/drivers', cors: true })
export class DriverAuthGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(DriverAuthGateway.name);

  @WebSocketServer()
  public server!: Server;

  constructor(
    private readonly tokenService: TokenService,
    private readonly sessionRepo: SessionRepository,
    private readonly usersRepo: UserRepository,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // 1) Token desde handshake
      const token =
        (client.handshake.auth as any)?.token ||
        (client.handshake.headers?.authorization || '').replace(
          /^Bearer\s+/i,
          '',
        );

      if (!token) throw new Error('Missing token');

      // 2) Verificar access token
      const payload = this.tokenService.verifyAccessToken<any>(token);
      const userId = payload?.sub as string | undefined;
      const sid = payload?.sid as string | undefined; // jti
      if (!userId || !sid) throw new Error('Missing sub/sid in token');

      // 3) Verificar usuario (debe ser DRIVER y ACTIVE para este namespace)
      const user = await this.usersRepo.findById(userId);
      if (!user) throw new Error('User not found');
      if (user.userType !== UserType.DRIVER)
        throw new Error('Wrong userType for /drivers');
      if (user.status !== UserStatus.ACTIVE) throw new Error('User not active');

      // 4) Verificar sesión (no revocada y access no expirado)
      const session = await this.sessionRepo.findOne({ where: { jti: sid } });
      if (!session) throw new Error('Session not found');
      if (session.revoked) throw new Error('Session revoked');
      if (
        session.accessTokenExpiresAt &&
        session.accessTokenExpiresAt < new Date()
      ) {
        throw new Error('Access token expired (session)');
      }

      // 5) Guardar contexto y unir a rooms
      (client as any).data = (client as any).data || {};
      (client as any).data.driverId = userId;
      (client as any).data.sid = sid;

      (client as any).join?.(`driver:${userId}`);
      (client as any).join?.(`session:${sid}`);

      this.logger.log(`Driver connected user=${userId} sid=${sid}`);
    } catch (e) {
      this.logger.warn(`WS /drivers handshake failed: ${(e as Error).message}`);
      client.disconnect(); // server disconnect
    }
  }

  async handleDisconnect(client: Socket) {
    // opcional: métricas, logs, etc.
    const data = (client as any).data || {};
    this.logger.log(
      `Driver disconnected user=${data.driverId ?? 'unknown'} sid=${data.sid ?? 'unknown'}`,
    );
  }
}
