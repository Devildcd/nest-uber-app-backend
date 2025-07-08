// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  ExtractJwt,
  VerifiedCallback,
  StrategyOptions,
} from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../user/services/user.service';
import { User } from 'src/modules/user/entities/user.entity';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UserService,
  ) {
    // 1) Leemos las variables de entorno y validamos que existan:
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET no está configurado');
    }
    const issuer = config.get<string>('JWT_ISSUER');
    const audience = config.get<string>('JWT_AUDIENCE');
    if (!issuer || !audience) {
      throw new Error('JWT_ISSUER o JWT_AUDIENCE no están configurados');
    }

    // 2) Armamos un objeto de tipo StrategyOptions (sin passReqToCallback):
    const opts: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // (req) => req?.cookies?.accessToken,  // cookie-parser
      ]),
      secretOrKey: secret,
      issuer,
      audience,
      ignoreExpiration: false,
      passReqToCallback: false,
    };
    super(opts);
  }

  /**
   * Se ejecuta si firma y expiración del JWT son correctas.
   * Aquí “desempaquetamos” el ApiResponse para obtener el User real.
   */
  async validate(payload: any, done: VerifiedCallback) {
    // 1) Llamamos al service y obtenemos la respuesta
    const resp: ApiResponse<User> = await this.usersService.findById(
      (payload as { sub: string }).sub,
    );

    // 2) Comprobamos que venga bien:
    if (!resp.success || !resp.data) {
      // Puede ser usuario no encontrado o error interno
      return done(
        new UnauthorizedException('Usuario no encontrado o inválido'),
        false,
      );
    }

    // 3) Ahora sí accedemos al User real
    const user: User = resp.data;

    // 4) Devolvemos sólo el payload que queramos exponer en req.user
    return done(null, {
      sub: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profilePictureUrl: user.profilePictureUrl,
    });
  }
}
