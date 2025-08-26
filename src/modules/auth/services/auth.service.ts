import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { LoginDto } from '../dto/login.dto';
import { UserService } from 'src/modules/user/services/user.service';
import { TokenService } from './token.service';
import { Session, SessionType } from '../entities/session.entity';
import { SessionRepository } from '../repositories/session.repository';
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import {
  RefreshTokenPayload,
  RefreshTokensResult,
} from '../interfaces/token.interface';
import { DeviceService } from 'src/modules/auth/services/device.service';
import { UserRepository } from 'src/modules/user/repositories/user.repository';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UserService,
    private readonly tokenService: TokenService,
    private readonly dataSource: DataSource,
    private readonly sessionRepo: SessionRepository,
    private readonly deviceService: DeviceService,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Loguea al usuario (por email o teléfono + password), crea sesión y emite tokens.
   * - En WEB: el refreshToken va en cookie HttpOnly
   * - En Mobile/API: ambos tokens se devuelven en el body
   */
  async login(dto: LoginDto, req: ExpressRequest, res?: ExpressResponse) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // 1) Validar credenciales
      const user = await this.usersService.validateUserCredentials(
        {
          email: dto.email,
          phoneNumber: dto.phoneNumber,
          password: dto.password,
        },
        qr.manager,
      );
      if (!user)
        throw new UnauthorizedException('Email o contraseña inválidos');

      // 2) Generar refresh token primero para obtener jti (o generar jti y pasarlo)
      const {
        token: refreshToken,
        jti,
        expiresIn: refreshTtl, // => TTL en milisegundos (según tu tokenService)
      } = this.tokenService.createRefreshToken({
        sub: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
      });

      // 3) Crear access token que incluya referencia a la sesión (sid/jti)
      const { token: accessToken, expiresIn: accessTtl } =
        this.tokenService.createAccessToken({
          sub: user.id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          sid: jti,
        });

      // calcular timestamps absolutos (ms desde epoch)
      const now = Date.now();
      const accessTokenExpiresAt = now + accessTtl;
      const refreshTokenExpiresAt = now + refreshTtl;

      // 3) Contexto cliente
      const context = this.deviceService.getClientContext(req);
      const sessionType =
        (dto.sessionType as SessionType) ??
        this.deviceService.inferSessionType(context.device.deviceType);

      // 5) Preparar & persistir sesión (hash del refresh token)
      const sessionRepo: Repository<Session> =
        qr.manager.getRepository(Session);
      const refreshTokenHash = await argon2.hash(refreshToken);

      const newSession = sessionRepo.create({
        user,
        sessionType,
        refreshTokenHash,
        jti,
        accessTokenExpiresAt: new Date(accessTokenExpiresAt),
        refreshTokenExpiresAt: new Date(refreshTokenExpiresAt),
        deviceInfo: context.device,
        ipAddress: context.ip,
        userAgent: context.userAgent,
        location: context.location,
        revoked: false,
        lastSuccessfulLoginAt: new Date(),
        lastActivityAt: new Date(),
      });

      await sessionRepo.save(newSession);
      await qr.commitTransaction();

      // 6) Devolver + cookie si WEB / API_CLIENT
      const baseResponse: any = {
        accessToken,
        sessionType,
        accessTokenExpiresAt, // ms since epoch
        refreshTokenExpiresAt, // ms since epoch
      };

      if (sessionType === SessionType.WEB && res) {
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: (process.env.COOKIE_SAME_SITE ?? 'lax') as
            | 'lax'
            | 'strict'
            | 'none',
          maxAge: refreshTtl,
          domain:
            process.env.NODE_ENV === 'production'
              ? process.env.COOKIE_DOMAIN
              : undefined,
          path: process.env.COOKIE_PATH ?? '/',
        });
        // no enviamos refreshToken en body (está en cookie), pero sí las expiraciones
        return { ...baseResponse };
      }

      // mobile: devolvemos también el refreshToken en body
      return { ...baseResponse, refreshToken };
    } catch (err) {
      await qr.rollbackTransaction();
      if (err instanceof UnauthorizedException) throw err;

      this.logger.error('Login error', err);
      throw new BadRequestException('Error inesperado durante el login');
    } finally {
      await qr.release();
    }
  }

  /**
   * Refresca el par de tokens dado un refreshToken.
   * - Verifica firma y jti
   * - Comprueba sesión no revocada
   * - Gira jti + token en BD
   * - Devuelve nuevo accessToken y renueva cookie si se pasa Response
   */
  async refreshTokens(
    oldRefreshToken: string,
    res?: ExpressResponse,
  ): Promise<RefreshTokensResult> {
    // 1) Verificar firma y extraer payload
    const payload = this.tokenService.verifyRefreshToken<{
      sub: string;
      email?: string;
      phoneNumber?: string;
      jti: string;
    }>(oldRefreshToken);

    // 2) Buscar la sesión actual y validar estado
    const session = await this.sessionRepo.findOne({
      where: { jti: payload.jti },
      relations: ['user'],
    });

    if (!session) {
      this.logger.warn('Refresh failed: session not found', {
        jti: payload.jti,
      });
      throw new UnauthorizedException(
        'Refresh token inválido o sesión no encontrada',
      );
    }

    if (session.revoked || session.refreshTokenExpiresAt! < new Date()) {
      this.logger.log('Refresh failed: session revoked or expired', {
        jti: session.jti,
        revoked: session.revoked,
        refreshTokenExpiresAt: session.refreshTokenExpiresAt,
      });
      throw new UnauthorizedException('Refresh token inválido o revocado');
    }

    // 2b) Verificar que el refresh token entrante coincide con el hash guardado
    let matched = false;
    try {
      matched = await argon2.verify(session.refreshTokenHash, oldRefreshToken);
    } catch {
      matched = false;
    }

    if (!matched) {
      // posible token reuse/tampering: revocar la sesión y rechazar inmediatamente
      this.logger.warn(
        'Possible refresh token reuse detected — revoking session',
        {
          jti: session.jti,
          userId: session.user?.id,
        },
      );

      session.revoked = true;
      (session as any).revokedAt = new Date();
      (session as any).revokedReason = 'token_reuse_detected';
      session.lastActivityAt = new Date();

      // intentamos persistir la revocación pero no fallaremos si hay error
      await this.sessionRepo.save(session).catch((e) => {
        this.logger.error(
          'Failed to save session while handling token reuse',
          e,
        );
      });

      // emitir evento para alertas / desconexiones WS
      // try {
      //   this.eventEmitter?.emit?.('session.revoked', {
      //     sessionId: session.id,
      //     userId: session.user?.id,
      //     jti: session.jti,
      //     reason: 'token_reuse_detected',
      //   });
      // } catch (e) {
      //   this.logger.debug('Event emit failed (session.revoked)', e);
      // }

      throw new UnauthorizedException('Refresh token inválido o revocado');
    }

    // 2c) obtener datos canónicos de usuario
    let user = session.user;
    if (!user) {
      const foundUser = await this.userRepository.findOne({
        where: { id: payload.sub },
      });
      if (!foundUser) {
        session.revoked = true;
        await this.sessionRepo.save(session).catch(() => {});
        throw new UnauthorizedException(
          'Usuario no encontrado para refresh token',
        );
      }
      user = foundUser;
    }

    // 3) Generar nuevos tokens usando datos canónicos del usuario (no los del token entrante)
    const refreshPayload: {
      sub: string;
      email?: string;
      phoneNumber?: string;
    } = {
      sub: user.id,
    };
    if (user.email) refreshPayload.email = user.email;
    if (user.phoneNumber) refreshPayload.phoneNumber = user.phoneNumber;

    const {
      token: refreshToken,
      jti: newJti,
      expiresIn: refreshTtl,
    } = this.tokenService.createRefreshToken(refreshPayload);

    const accessPayload: {
      sub: string;
      email?: string;
      phoneNumber?: string;
      sid?: string;
    } = { sub: user.id, sid: newJti };
    if (user.email) accessPayload.email = user.email;
    if (user.phoneNumber) accessPayload.phoneNumber = user.phoneNumber;

    const { token: accessToken, expiresIn: accessTtl } =
      this.tokenService.createAccessToken(accessPayload);

    // 4) Actualizar la sesión con el nuevo jti/tokens y expiraciones
    session.jti = newJti;
    session.refreshTokenHash = await argon2.hash(refreshToken);
    session.refreshTokenExpiresAt = new Date(Date.now() + refreshTtl);
    session.accessTokenExpiresAt = new Date(Date.now() + accessTtl);
    session.lastActivityAt = new Date();

    await this.sessionRepo.save(session);

    // 5) Preparar la respuesta base (timestamps en ms)
    const baseResponse: RefreshTokensResult = {
      accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt.getTime(),
      refreshTokenExpiresAt: session.refreshTokenExpiresAt.getTime(),
      sid: session.jti,
      sessionType: session.sessionType,
    };

    // 6) Renueva cookie cuando corresponde (WEB / API_CLIENT)
    if (res) {
      try {
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: (process.env.COOKIE_SAME_SITE ?? 'lax') as
            | 'lax'
            | 'strict'
            | 'none',
          maxAge: refreshTtl,
          domain:
            process.env.NODE_ENV === 'production'
              ? process.env.COOKIE_DOMAIN
              : undefined,
          path: process.env.COOKIE_PATH ?? '/',
        });
      } catch (err) {
        // no queremos que un error al setear la cookie rompa el refresh
        this.logger.error('Failed to set refresh cookie', err);
      }

      // Emitir evento de refresh (útil para auditoría / métricas)
      // try {
      //   this.eventEmitter?.emit?.('session.refreshed', {
      //     sessionId: session.id,
      //     userId: user.id,
      //     jti: session.jti,
      //   });
      // } catch (e) {
      //   this.logger.debug('Event emit failed (session.refreshed)', e);
      // }

      return baseResponse;
    }

    // 7) Mobile / clientes sin cookie: devolvemos refreshToken en body
    const result: RefreshTokensResult = {
      ...baseResponse,
      refreshToken,
    };

    // try {
    //   this.eventEmitter?.emit?.('session.refreshed', {
    //     sessionId: session.id,
    //     userId: user.id,
    //     jti: session.jti,
    //   });
    // } catch (e) {
    //   this.logger.debug('Event emit failed (session.refreshed)', e);
    // }

    return result;
  }

  /**
   * Invalida la sesión asociada al refreshToken dado.
   */
  async logout(oldRefreshToken: string, res?: ExpressResponse): Promise<void> {
    let jti: string | undefined;

    // 1) Intentamos extraer jti (si falla, seguimos para limpiar cookie)
    try {
      const payload =
        this.tokenService.verifyRefreshToken<RefreshTokenPayload>(
          oldRefreshToken,
        );
      jti = payload.jti;
    } catch (err) {
      // No abortamos: puede venir un token malformado/expirado — igual queremos limpiar la cookie.
      this.logger.warn('Logout: refresh token verification failed', {
        message: (err as Error)?.message ?? err,
      });
    }

    // 2) Si obtuvimos jti -> buscar sesión y marcar como revocada con metadata
    if (jti) {
      try {
        const session = await this.sessionRepo.findOne({
          where: { jti },
          relations: ['user'],
        });

        if (session) {
          session.revoked = true;
          // Campos útiles para auditoría y detección de anomalías
          (session as any).revokedAt = new Date();
          (session as any).revokedReason = 'user_logout'; // si tienes columna, úsala
          session.lastActivityAt = new Date();

          // Opcional: limpiar el hash del refresh token para que no pueda verificarse en el futuro.
          // -> Solo si tu columna permite NULL; si no, omítelo.
          // session.refreshTokenHash = null;

          await this.sessionRepo.save(session);

          // Emitir evento para auditoría / notificaciones / invalidación en otros sistemas
          // try {
          //   this.eventEmitter?.emit?.('session.revoked', {
          //     sessionId: session.id,
          //     userId: session.user?.id,
          //     jti: session.jti,
          //     reason: 'user_logout',
          //   });
          // } catch (e) {
          //   this.logger.debug('Logout: eventEmitter failed', e);
          // }
        } else {
          // sesión no encontrada: ya estaba revocada o nunca existió
          this.logger.debug('Logout: session not found for jti', { jti });
        }
      } catch (err) {
        this.logger.error('Logout: error updating session', err);
        // no re-lanzamos: la limpieza de cookie debe ocurrir siempre
      }
    }

    // 3) Limpiar cookie (si aplica)
    if (res) {
      // mantener la misma configuración que usas en login/refresh para consistencia
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: (process.env.COOKIE_SAME_SITE ?? 'lax') as
          | 'lax'
          | 'strict'
          | 'none',
        domain:
          process.env.NODE_ENV === 'production'
            ? process.env.COOKIE_DOMAIN
            : undefined,
        path: process.env.COOKIE_PATH ?? '/',
      });
    }
  }
}
