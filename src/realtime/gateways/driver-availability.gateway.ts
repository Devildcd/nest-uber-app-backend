import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TokenService } from 'src/modules/auth/services/token.service';
import { SessionRepository } from 'src/modules/auth/repositories/session.repository';
import { UserRepository } from 'src/modules/user/repositories/user.repository';
import { UserStatus, UserType } from 'src/modules/user/entities/user.entity';
import { DriverAvailabilityService } from 'src/modules/drivers-availability/services/driver-availability.service';
import { UpdateDriverStatusDto } from 'src/modules/drivers-availability/dtos/update-status.dto';
import { UpdateDriverLocationDto } from 'src/modules/drivers-availability/dtos/update-location.dto';
import { UpdateDriverTripDto } from 'src/modules/drivers-availability/dtos/update-trip.dto';
import { DriverSocketData } from '../interfaces/ws-context.interface';
import { WsJwtGuard } from '../guards/ws-jwt.guard';
import { Rooms } from '../rooms/ws-topics';
import { WsServersRegistry } from '../ws-servers.registry';

const driverRoom = (driverId: string) => `driver:${driverId}`;
const sessionRoom = (sid: string) => `session:${sid}`;

@UseGuards(WsJwtGuard)
@WebSocketGateway({
  namespace: '/drivers',
  cors: { origin: '*', credentials: true },
  pingTimeout: 20000,
  pingInterval: 25000,
})
export class DriverAvailabilityGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(DriverAvailabilityGateway.name);

  @WebSocketServer()
  public server!: Server;

  constructor(
    private readonly tokenService: TokenService,
    private readonly sessionRepo: SessionRepository,
    private readonly usersRepo: UserRepository,
    private readonly availabilityService: DriverAvailabilityService,
    private readonly wsRegistry: WsServersRegistry,
  ) {}

  afterInit(server: Server) {
    this.logger.log(`[GATEWAY] /drivers afterInit server=${server as any}`);
    this.wsRegistry.register('/drivers', server);
  }

  async handleConnection(client: Socket) {
    try {
      // 1) Token desde auth.token o Authorization: Bearer
      const token =
        (client.handshake.auth as any)?.token ||
        (client.handshake.headers?.authorization || '').replace(
          /^Bearer\s+/i,
          '',
        );
      if (!token) throw new Error('Missing token');

      // 2) Verificación JWT
      const payload = this.tokenService.verifyAccessToken<any>(token);
      const userId = payload?.sub as string | undefined;
      const sid = payload?.sid as string | undefined; // jti del access token
      if (!userId || !sid) throw new Error('Missing sub/sid');

      // 3) Validaciones de usuario y sesión
      const user = await this.usersRepo.findById(userId);
      if (!user) throw new Error('User not found');
      if (user.userType !== UserType.DRIVER) throw new Error('Wrong userType');
      if (user.status !== UserStatus.ACTIVE) throw new Error('User inactive');

      const session = await this.sessionRepo.findOne({ where: { jti: sid } });
      if (!session || session.revoked) throw new Error('Invalid session');
      if (
        session.accessTokenExpiresAt &&
        session.accessTokenExpiresAt < new Date()
      ) {
        throw new Error('Access expired');
      }

      // 4) Datos útiles en el socket
      const data: DriverSocketData = {
        userId,
        driverId: userId,
        jti: sid,
        sessionId: (session as any)?.id ?? sid,
        userType: 'DRIVER',
      };
      (client.data as DriverSocketData) = data;

      // 5) Unirse a rooms canónicas
      await client.join(Rooms.driver(userId));
      await client.join(`session:${sid}`);

      // 6) Logs y saludo (para tu script)
      this.logger.log(
        `Driver WS connected user=${userId} sid=${sid} nsp=${client.nsp?.name} rooms=[${Rooms.driver(userId)}, session:${sid}]`,
      );
      client.emit('hello', { ok: true, nsp: '/drivers' });
    } catch (e) {
      this.logger.warn(`Driver WS handshake failed: ${(e as Error).message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const d = (client.data as Partial<DriverSocketData>) || {};
    this.logger.log(
      `Driver WS disconnected user=${d.driverId ?? d.userId ?? 'unknown'} sid=${d.jti ?? 'unknown'} nsp=${client.nsp?.name}`,
    );
  }

  @SubscribeMessage('driver:status:update')
  async onStatus(
    @MessageBody() body: UpdateDriverStatusDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const driverId = (client as any).data?.driverId as string;
      if (!driverId) throw new WsException('Unauthorized');

      const updated = await this.availabilityService.updateStatus(
        driverId,
        body,
      );

      // Broadcast post-commit: incluir al emisor
      this.server
        .to(`driver:${driverId}`)
        .emit('driver:availability:update', updated);
      // (opcional) avisar a dashboards:
      this.server
        .to('admin:drivers')
        .emit('driver:availability:update', updated);

      return { ok: true, data: updated }; // ACK
    } catch (e) {
      throw new WsException((e as Error)?.message ?? 'status update failed');
    }
  }

  @SubscribeMessage('driver:location:ping')
  async onLocation(
    @MessageBody() body: UpdateDriverLocationDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const driverId = (client as any).data?.driverId as string;
      if (!driverId) throw new WsException('Unauthorized');

      const updated = await this.availabilityService.updateLocation(
        driverId,
        body,
      );

      // Para clientes: manda un payload ligero (coordenadas + ts)
      this.server.to(`driver:${driverId}`).emit('driver:location:update', {
        driverId,
        lastLocation: updated.lastLocation,
        lastLocationTimestamp: updated.lastLocationTimestamp,
      });
      this.server.to('admin:drivers').emit('driver:location:update', {
        driverId,
        lastLocation: updated.lastLocation,
        lastLocationTimestamp: updated.lastLocationTimestamp,
      });

      return { ok: true }; // ACK
    } catch (e) {
      throw new WsException((e as Error)?.message ?? 'location update failed');
    }
  }

  @SubscribeMessage('driver:trip:set')
  async onTrip(
    @MessageBody() body: UpdateDriverTripDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const driverId = (client as any).data?.driverId as string;
      if (!driverId) throw new WsException('Unauthorized');

      const updated = await this.availabilityService.setOrClearTrip(
        driverId,
        body,
      );

      this.server.to(`driver:${driverId}`).emit('driver:trip:update', {
        driverId,
        currentTripId: updated.currentTripId,
        availabilityReason: updated.availabilityReason,
        isAvailableForTrips: updated.isAvailableForTrips,
      });
      this.server.to('admin:drivers').emit('driver:trip:update', {
        driverId,
        currentTripId: updated.currentTripId,
        availabilityReason: updated.availabilityReason,
        isAvailableForTrips: updated.isAvailableForTrips,
      });

      return { ok: true, data: updated }; // ACK
    } catch (e) {
      throw new WsException((e as Error)?.message ?? 'trip update failed');
    }
  }
}
