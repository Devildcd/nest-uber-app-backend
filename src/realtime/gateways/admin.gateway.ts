import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TokenService } from 'src/modules/auth/services/token.service';
import { SessionRepository } from 'src/modules/auth/repositories/session.repository';
import { UserRepository } from 'src/modules/user/repositories/user.repository';
import { UserStatus, UserType } from 'src/modules/user/entities/user.entity';

@WebSocketGateway({ namespace: '/admin', cors: true })
export class AdminGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AdminGateway.name);

  @WebSocketServer() public server!: Server;

  constructor(
    private readonly tokenService: TokenService,
    private readonly sessionRepo: SessionRepository,
    private readonly usersRepo: UserRepository,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as any)?.token ||
        (client.handshake.headers?.authorization || '').replace(
          /^Bearer\s+/i,
          '',
        );
      if (!token) throw new Error('Missing token');

      const payload = this.tokenService.verifyAccessToken<any>(token);
      const userId = payload?.sub as string | undefined;
      const sid = payload?.sid as string | undefined;
      if (!userId || !sid) throw new Error('Missing sub/sid');

      const user = await this.usersRepo.findById(userId);
      if (!user) throw new Error('User not found');
      if (user.status !== UserStatus.ACTIVE) throw new Error('User inactive');

      // Aquí decides quién puede entrar: ADMIN, DISPATCHER, OPS, etc.
      if (user.userType === UserType.DRIVER)
        throw new Error('Drivers not allowed in /admin');

      const session = await this.sessionRepo.findOne({ where: { jti: sid } });
      if (!session || session.revoked) throw new Error('Invalid session');

      // Rooms de admin
      (client as any).data = { userId, sid, role: user.userType };
      (client as any).join?.('admin:all');

      // Opcional: por organización/ciudad/tenant
      // const orgId = user.orgId; if (orgId) (client as any).join?.(`admin:org:${orgId}`);

      this.logger.log(`Admin WS connected user=${userId} sid=${sid}`);
    } catch (e) {
      this.logger.warn(`Admin WS handshake failed: ${(e as Error).message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const d = (client as any).data || {};
    this.logger.log(
      `Admin WS disconnected user=${d.userId ?? 'unknown'} sid=${d.sid ?? 'unknown'}`,
    );
  }
}
