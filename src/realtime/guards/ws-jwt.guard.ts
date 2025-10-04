import { CanActivate, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io'; // <- server-side
import { TokenService } from 'src/modules/auth/services/token.service';
import { UserRepository } from 'src/modules/user/repositories/user.repository';
import { UserStatus, UserType } from 'src/modules/user/entities/user.entity';
import { SessionRepository } from 'src/modules/auth/repositories/session.repository';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);
  constructor(
    private readonly tokenService: TokenService,
    private readonly sessionRepo: SessionRepository,
    private readonly usersRepo: UserRepository,
  ) {}

  async canActivate(context: any): Promise<boolean> {
    const client = context.switchToWs().getClient();

    const token =
      client?.handshake?.auth?.token ||
      (client?.handshake?.headers?.authorization || '').replace(
        /^Bearer\s+/i,
        '',
      );

    if (!token) {
      this.logger.warn('[WS] Missing token in handshake');
      throw new WsException('Unauthorized');
    }

    let payload: any;
    try {
      payload = this.tokenService.verifyAccessToken<any>(token);
    } catch (e) {
      this.logger.warn(`[WS] Invalid access token: ${(e as Error).message}`);
      throw new WsException('Unauthorized');
    }

    const userId = payload?.sub as string | undefined;
    const sid = payload?.sid as string | undefined;
    if (!userId || !sid) {
      this.logger.warn('[WS] Missing sub or sid in token payload');
      throw new WsException('Unauthorized');
    }

    const user = await this.usersRepo.findById(userId);
    if (!user) {
      this.logger.warn(`[WS] User not found: ${userId}`);
      throw new WsException('Forbidden');
    }
    if (user.userType !== UserType.DRIVER) {
      this.logger.warn(
        `[WS] Wrong userType (${user.userType}) for namespace /drivers`,
      );
      throw new WsException('Forbidden');
    }
    if (user.status !== UserStatus.ACTIVE) {
      this.logger.warn(`[WS] User not active: ${userId} status=${user.status}`);
      throw new WsException('Forbidden');
    }

    const session = await this.sessionRepo.findOne({ where: { jti: sid } });
    if (!session) {
      this.logger.warn(`[WS] Session not found for sid=${sid}`);
      throw new WsException('Unauthorized');
    }
    if (session.revoked) {
      this.logger.warn(`[WS] Session revoked sid=${sid}`);
      throw new WsException('Unauthorized');
    }
    const now = new Date();
    if (session.accessTokenExpiresAt && session.accessTokenExpiresAt < now) {
      this.logger.warn(`[WS] Access token expired for sid=${sid}`);
      throw new WsException('Unauthorized');
    }

    // OK
    client.data = client.data || {};
    client.data.driverId = userId;
    client.data.sid = sid;
    this.logger.log(`[WS] Auth OK user=${userId} sid=${sid}`);
    return true;
  }
}
