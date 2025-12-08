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
import { Rooms } from '../rooms/ws-topics';
import { WsServersRegistry } from '../ws-servers.registry';

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
    private readonly wsRegistry: WsServersRegistry,
  ) {}

  afterInit(server: Server) {
    this.wsRegistry.register('/passengers', server);
  }

  async handleConnection(client: Socket) {
    try {
      // 1) Extraer token del handshake (auth.token o Authorization: Bearer ...)
      const token =
        (client.handshake.auth as any)?.token ||
        (client.handshake.headers?.authorization || '').replace(
          /^Bearer\s+/i,
          '',
        );

      if (!token) throw new Error('Missing token');

      // 2) Verificar JWT
      const payload = this.tokenService.verifyAccessToken<any>(token);
      const userId: string | undefined = payload?.sub;
      const sid: string | undefined = payload?.sid;
      if (!userId || !sid) throw new Error('Missing sub/sid');

      // 3) Validar usuario y sesión
      const user = await this.usersRepo.findById(userId);
      if (!user) throw new Error('User not found');
      if (user.userType !== UserType.PASSENGER)
        throw new Error('Wrong userType for /passengers');
      if (user.status !== UserStatus.ACTIVE) throw new Error('User not active');

      const session = await this.sessionRepo.findOne({ where: { jti: sid } });
      if (!session || session.revoked) throw new Error('Invalid session');
      if (
        session.accessTokenExpiresAt &&
        session.accessTokenExpiresAt < new Date()
      ) {
        throw new Error('Access expired');
      }

      // 4) Guardar datos útiles en el socket
      client.data = { passengerId: userId, sid };

      // 5) Unirse a rooms canónicas
      await client.join(Rooms.passenger(userId));
      await client.join(`session:${sid}`);

      // 6) Logs útiles (incluye namespace)
      this.logger.log(
        `Passenger WS connected user=${userId} sid=${sid} nsp=${client.nsp?.name} rooms=[${Rooms.passenger(userId)}, session:${sid}]`,
      );

      // 7) Handshake "hello" opcional para tu script de pruebas
      client.emit('hello', { ok: true, nsp: '/passengers' });
    } catch (e) {
      this.logger.warn(
        `Passenger WS handshake failed: ${(e as Error).message}`,
      );
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const d = client.data || {};
    this.logger.log(
      `Passenger WS disconnected user=${d.passengerId ?? 'unknown'} sid=${d.sid ?? 'unknown'} nsp=${client.nsp?.name}`,
    );
  }
}
