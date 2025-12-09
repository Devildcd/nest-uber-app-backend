import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AppAudience, LoginDto } from '../dto/login.dto';
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
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuthEvents,
  SessionRefreshedEvent,
  SessionRevokedEvent,
  UserLoggedInEvent,
} from 'src/core/domain/events/auth.events';
import { UserStatus, UserType } from 'src/modules/user/entities/user.entity';

//Mapea audiencia → rol esperado
const AUDIENCE_TO_USER_TYPE: Record<AppAudience, UserType> = {
  [AppAudience.DRIVER_APP]: UserType.DRIVER,
  [AppAudience.PASSENGER_APP]: UserType.PASSENGER,
  [AppAudience.ADMIN_PANEL]: UserType.ADMIN,
  [AppAudience.API_CLIENT]: UserType.ADMIN,
};

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
    private readonly eventEmitter: EventEmitter2,
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
      // 1) Credenciales
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

      // 1.1) Estado del usuario
      if (user.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException('La cuenta no está activa');
      }

      // 1.2) Verificación de rol según audiencia
      const requiredUserType = AUDIENCE_TO_USER_TYPE[dto.appAudience];
      if (requiredUserType && user.userType !== requiredUserType) {
        // Mensaje claro para no filtrar existencias
        throw new ForbiddenException('No tienes permisos para esta aplicación');
      }

      // (Opcional) si envías expectedUserType, valida que coincida con el real
      if (dto.expectedUserType && dto.expectedUserType !== user.userType) {
        throw new ForbiddenException('Rol inválido para este usuario');
      }

      // 2) Refresh token (para jti)
      const {
        token: refreshToken,
        jti,
        expiresIn: refreshTtl,
      } = this.tokenService.createRefreshToken({
        sub: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
      });

      // 3) Access token (incluye rol + sid + aud)
      const { token: accessToken, expiresIn: accessTtl } =
        this.tokenService.createAccessToken({
          sub: user.id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          sid: jti,
          aud: dto.appAudience, // 👈 quién consumirá este token
          userType: user.userType, // 👈 rol visible al front
          // scope: ['trips:read', 'trips:write'] // si manejas permisos finos
        });

      const now = Date.now();
      const accessTokenExpiresAt = now + accessTtl;
      const refreshTokenExpiresAt = now + refreshTtl;

      // 4) Contexto cliente + sessionType
      const context = this.deviceService.getClientContext(req);
      const sessionType =
        (dto.sessionType as SessionType) ??
        this.deviceService.inferSessionType(context.device.deviceType);

      // 5) Persistir sesión
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
        appAudience: dto.appAudience,
      });

      await sessionRepo.save(newSession);
      await qr.commitTransaction();

      // 6) Evento
      const ev: UserLoggedInEvent = {
        userId: user.id,
        userType: user.userType,
        sid: jti,
        sessionType,
        at: new Date().toISOString(),
        deviceInfo: context.device,
        ipAddress: context.ip,
        userAgent: context.userAgent,
        // aud: dto.appAudience
      };
      this.eventEmitter.emit(AuthEvents.UserLoggedIn, ev);

      // 7) Respuesta + cookie si WEB
      const baseResponse: any = {
        accessToken,
        sessionType,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        userType: user.userType, // 👈 facilita al front
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          userType: user.userType,
          profilePictureUrl: user.profilePictureUrl,
          preferredLanguage: user.preferredLanguage,
        },
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
        return { ...baseResponse };
      }

      return { ...baseResponse, refreshToken };
    } catch (err) {
      await qr.rollbackTransaction();
      if (
        err instanceof UnauthorizedException ||
        err instanceof ForbiddenException
      )
        throw err;
      this.logger.error('Login error', err);
      throw new BadRequestException('Error inesperado durante el login');
    } finally {
      await qr.release();
    }
  }

  /**
   * Refresca el par de tokens dado un refreshToken.
   * - Verifica firma y jti
   * - Comprueba sesión no revocada / no expirada
   * - Verifica reuse (hash) y estado del usuario
   * - Revalida rol según audiencia guardada en la sesión
   * - Gira jti y firma access con { aud, userType } consistentes
   * - Renueva cookie si se pasa Response (WEB/API_CLIENT)
   */
  async refreshTokens(
    oldRefreshToken: string,
    res?: ExpressResponse,
  ): Promise<RefreshTokensResult> {
    // 1) Verificar firma y extraer payload mínimo
    const payload = this.tokenService.verifyRefreshToken<{
      sub: string;
      email?: string;
      phoneNumber?: string;
      jti: string;
    }>(oldRefreshToken);

    // 2) Buscar la sesión y validar estado
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

    // 2b) Anti-reuse: comparar contra hash
    let matched = false;
    try {
      matched = await argon2.verify(session.refreshTokenHash, oldRefreshToken);
    } catch {
      matched = false;
    }

    if (!matched) {
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
      await this.sessionRepo
        .save(session)
        .catch((e) =>
          this.logger.error(
            'Failed to save session while handling token reuse',
            e,
          ),
        );

      this.emitSafely<SessionRevokedEvent>(AuthEvents.SessionRevoked, {
        userId: session.user?.id ?? payload.sub,
        sid: session.jti,
        reason: 'token_reuse_detected',
        at: new Date().toISOString(),
      });

      throw new UnauthorizedException('Refresh token inválido o revocado');
    }

    // 2c) Usuario canónico
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

    // 2d) Usuario ACTIVO
    if (user.status !== UserStatus.ACTIVE) {
      session.revoked = true;
      (session as any).revokedAt = new Date();
      (session as any).revokedReason = 'user_inactive_on_refresh';
      await this.sessionRepo.save(session).catch(() => {});
      throw new UnauthorizedException('Cuenta inactiva');
    }

    // 2e) Audiencia guardada en la sesión (¡debe haberse persistido en login!)
    const appAudience = session.appAudience as AppAudience | undefined;
    if (!appAudience) {
      // Si por compatibilidad antigua no la tienes, puedes:
      // - Inferirla (no recomendado), o
      // - Fallar explícitamente para no firmar un access inconsistente.
      this.logger.error(
        'Session missing appAudience; cannot issue coherent access token',
        { sid: session.jti },
      );
      throw new UnauthorizedException('Sesión inválida (audiencia ausente)');
    }

    // 2f) Revalidar rol según audiencia (como en login)
    const requiredUserType = AUDIENCE_TO_USER_TYPE[appAudience];
    if (requiredUserType && user.userType !== requiredUserType) {
      session.revoked = true;
      (session as any).revokedAt = new Date();
      (session as any).revokedReason = 'role_mismatch_on_refresh';
      await this.sessionRepo.save(session).catch(() => {});
      throw new UnauthorizedException('Refresh token inválido o revocado');
    }

    // 3) Generar nuevos tokens (con datos canónicos)
    const refreshPayload: {
      sub: string;
      email?: string;
      phoneNumber?: string;
    } = { sub: user.id };
    if (user.email) refreshPayload.email = user.email;
    if (user.phoneNumber) refreshPayload.phoneNumber = user.phoneNumber;

    const {
      token: refreshToken,
      jti: newJti,
      expiresIn: refreshTtl,
    } = this.tokenService.createRefreshToken(refreshPayload);

    // Access coherente con login: incluye { sid, aud, userType }
    const accessPayload: {
      sub: string;
      email?: string;
      phoneNumber?: string;
      sid: string;
      aud: AppAudience;
      userType: UserType;
    } = {
      sub: user.id,
      sid: newJti,
      aud: appAudience,
      userType: user.userType,
    };
    if (user.email) accessPayload.email = user.email;
    if (user.phoneNumber) accessPayload.phoneNumber = user.phoneNumber;

    const { token: accessToken, expiresIn: accessTtl } =
      this.tokenService.createAccessToken(accessPayload);

    // 4) Rotar sesión: nuevo jti + expiraciones
    const oldSid = session.jti;
    session.jti = newJti;
    session.refreshTokenHash = await argon2.hash(refreshToken);
    session.refreshTokenExpiresAt = new Date(Date.now() + refreshTtl);
    session.accessTokenExpiresAt = new Date(Date.now() + accessTtl);
    session.lastActivityAt = new Date();
    // nos aseguramos de que la audiencia siga guardada
    if (!session.appAudience) session.appAudience = appAudience;

    await this.sessionRepo.save(session);

    // Evento
    this.emitSafely<SessionRefreshedEvent>(AuthEvents.SessionRefreshed, {
      userId: user.id,
      oldSid,
      newSid: session.jti,
      at: new Date().toISOString(),
    });

    // 5) Respuesta base
    const baseResponse: RefreshTokensResult = {
      accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt.getTime(),
      refreshTokenExpiresAt: session.refreshTokenExpiresAt.getTime(),
      sid: session.jti,
      sessionType: session.sessionType,
      // (opcional) devolver userType si te ayuda en el cliente:
      // userType: user.userType as any
    };

    // 6) Cookie para WEB/API_CLIENT
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
        this.logger.error('Failed to set refresh cookie', err);
      }
      return baseResponse;
    }

    // 7) Mobile / sin cookie: devuelve refreshToken en body
    return { ...baseResponse, refreshToken };
  }

  /**
   * Invalida la sesión asociada al refreshToken dado.
   */
  async logout(oldRefreshToken: string, res?: ExpressResponse): Promise<void> {
    let jti: string | undefined;
    let sub: string | undefined;

    // 1) Intentamos extraer jti (si falla, seguimos para limpiar cookie)
    try {
      const payload =
        this.tokenService.verifyRefreshToken<RefreshTokenPayload>(
          oldRefreshToken,
        );
      jti = payload.jti;
      sub = payload.sub;
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

          // 🔔 Evento de dominio → el publisher desconectará sockets de session:{sid}
          this.emitSafely<SessionRevokedEvent>(AuthEvents.SessionRevoked, {
            userId: session.user?.id ?? sub,
            sid: session.jti,
            reason: 'user_logout',
            at: new Date().toISOString(),
          });
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

  private emitSafely<T = any>(eventName: string, payload: T) {
    try {
      this.eventEmitter.emit(eventName, payload);
    } catch (e) {
      this.logger.debug(`Event emit failed (${eventName})`, e);
    }
  }
}
