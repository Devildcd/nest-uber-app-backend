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
import { Response as ExpressResponse } from 'express';
import { RefreshTokenPayload } from '../interfaces/token.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UserService,
    private readonly tokenService: TokenService,
    private readonly dataSource: DataSource,
    private readonly sessionRepo: SessionRepository,
  ) {}

  /**
   * Loguea al usuario (por email o teléfono + password), crea sesión y emite tokens.
   * - En WEB: el refreshToken va en cookie HttpOnly
   * - En Mobile/API: ambos tokens se devuelven en el body
   */
  async login(
    dto: LoginDto,
    res?: ExpressResponse,
  ): Promise<{ accessToken: string; refreshToken?: string }> {
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
      if (!user) {
        throw new UnauthorizedException('Email o contraseña inválidos');
      }

      // 2) Generar tokens
      const { token: accessToken, expiresIn: accessTtl } =
        this.tokenService.createAccessToken({
          sub: user.id,
          email: user.email,
        });
      const {
        token: refreshToken,
        jti,
        expiresIn: refreshTtl,
      } = this.tokenService.createRefreshToken({
        sub: user.id,
        email: user.email,
      });

      // 3) Obtener repositorio “bare” de Session dentro de la transacción
      const sessionRepo: Repository<Session> =
        qr.manager.getRepository(Session);

      const newSession = sessionRepo.create({
        user,
        sessionType: dto.sessionType ?? SessionType.WEB,
        accessToken,
        refreshToken,
        jti,
        accessTokenExpiresAt: new Date(Date.now() + accessTtl),
        refreshTokenExpiresAt: new Date(Date.now() + refreshTtl),
        deviceInfo: dto.deviceInfo,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        location: dto.location,
      });

      // 4) Guardar sesión y hacer commit
      await sessionRepo.save(newSession);
      await qr.commitTransaction();

      // 5) Devolver tokens (y cookie en WEB)
      if (dto.sessionType === SessionType.WEB && res) {
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: refreshTtl,
          domain: process.env.COOKIE_DOMAIN,
          path: process.env.COOKIE_PATH,
        });
        return { accessToken };
      }
      return { accessToken, refreshToken };
    } catch (err) {
      await qr.rollbackTransaction();
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error('Login error', err);
      throw new BadRequestException('Unexpected error during login');
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
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    // 1) Verificar firma y extraer payload
    const payload = this.tokenService.verifyRefreshToken<{
      sub: string;
      email: string;
      jti: string;
    }>(oldRefreshToken);

    // 2) Buscar la sesión actual y validar estado
    const session = await this.sessionRepo.findOne({
      where: { jti: payload.jti },
    });
    if (
      !session ||
      session.revoked ||
      session.refreshTokenExpiresAt < new Date()
    ) {
      throw new UnauthorizedException('Refresh token inválido o revocado');
    }

    // 3) Generar nuevos tokens
    const { token: accessToken, expiresIn: accessTtl } =
      this.tokenService.createAccessToken({
        sub: payload.sub,
        email: payload.email,
      });
    const {
      token: refreshToken,
      jti,
      expiresIn: refreshTtl,
    } = this.tokenService.createRefreshToken({
      sub: payload.sub,
      email: payload.email,
    });

    // 4) Actualizar la sesión con el nuevo jti y token
    session.jti = jti;
    session.refreshToken = refreshToken;
    session.refreshTokenExpiresAt = new Date(Date.now() + refreshTtl);
    session.accessToken = accessToken;
    session.accessTokenExpiresAt = new Date(Date.now() + accessTtl);
    await this.sessionRepo.save(session);

    // 5) Opcional: renovar cookie en entornos WEB
    if (res) {
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: refreshTtl,
        domain: process.env.COOKIE_DOMAIN,
        path: process.env.COOKIE_PATH,
      });
      return { accessToken };
    }

    // 6) Para APIs móviles o llamadas sin cookie
    return { accessToken, refreshToken };
  }

  /**
   * Invalida la sesión asociada al refreshToken dado.
   */
  async logout(oldRefreshToken: string, res?: ExpressResponse): Promise<void> {
    try {
      const { jti } =
        this.tokenService.verifyRefreshToken<RefreshTokenPayload>(
          oldRefreshToken,
        );
      await this.sessionRepo.update({ jti }, { revoked: true });
    } catch {
      // si falla verificación, igual limpiamos cookie para no dejarla colgando
    }
    if (res) {
      res.clearCookie('refreshToken', {
        domain: process.env.COOKIE_DOMAIN,
        path: process.env.COOKIE_PATH,
      });
    }
  }
}
