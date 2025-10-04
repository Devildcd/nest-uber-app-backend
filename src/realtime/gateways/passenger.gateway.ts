import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { TokenService } from 'src/modules/auth/services/token.service';
import { SessionRepository } from 'src/modules/auth/repositories/session.repository';
import { UserRepository } from 'src/modules/user/repositories/user.repository';
import { UserStatus, UserType } from 'src/modules/user/entities/user.entity';

@WebSocketGateway({ namespace: '/passengers', cors: true })
export class PassengerGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(PassengerGateway.name);

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

      const payload = this.tokenService.verifyAccessToken<any>(token);
      const userId: string | undefined = payload?.sub;
      const sid: string | undefined = payload?.sid;
      if (!userId || !sid) throw new Error('Missing sub/sid');

      const user = await this.usersRepo.findById(userId);
      if (!user) throw new Error('User not found');
      if (user.userType !== UserType.PASSENGER)
        throw new Error('Wrong userType for /passengers');
      if (user.status !== UserStatus.ACTIVE) throw new Error('User not active');

      const session = await this.sessionRepo.findOne({ where: { jti: sid } });
      if (!session || session.revoked) throw new Error('Invalid session');

      (client as any).data = { passengerId: userId, sid };
      (client as any).join?.(`passenger:${userId}`);
      (client as any).join?.(`session:${sid}`);

      this.logger.log(`Passenger WS connected user=${userId} sid=${sid}`);
    } catch (e) {
      this.logger.warn(
        `Passenger WS handshake failed: ${(e as Error).message}`,
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const d = (client as any).data || {};
    this.logger.log(
      `Passenger WS disconnected user=${d.passengerId ?? 'unknown'} sid=${d.sid ?? 'unknown'}`,
    );
  }
}
