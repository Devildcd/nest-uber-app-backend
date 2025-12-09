// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../user/services/user.service';
import { User } from 'src/modules/user/entities/user.entity';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UserService,
  ) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) throw new Error('JWT_ACCESS_SECRET no está configurado');

    const issuer = config.get<string>('JWT_ISSUER');
    if (!issuer) throw new Error('JWT_ISSUER no está configurado');

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // (req) => req?.cookies?.accessToken, // si algún día usas cookie para ACCESS
      ]),
      secretOrKey: secret,
      issuer,
      ignoreExpiration: false,
    });
  }

  // Nest espera que retornes el objeto que quedará en req.user
  async validate(payload: any) {
    // Si quieres validar que el usuario aún existe/activo:
    const resp: ApiResponse<User> = await this.usersService.findById(
      payload.sub,
    );
    if (!resp?.success || !resp.data) {
      throw new UnauthorizedException('Usuario no encontrado o inválido');
    }
    const user = resp.data;

    // Retorna lo que quieras exponer como req.user
    return {
      sub: user.id,
      id: user.id, // por comodidad para tu GetUserId
      aud: payload.aud, // útil si luego chequeas audiencia
      userType: payload.userType, // idem
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profilePictureUrl: user.profilePictureUrl,
    };
  }
}
