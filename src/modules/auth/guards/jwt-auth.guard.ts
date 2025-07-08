// src/auth/guards/jwt-auth.guard.ts
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  // 1) Permite rutas públicas marcadas con @Public()
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  // 2) Captura errores y personaliza respuestas
  handleRequest(err: any, user: any, info: Error) {
    if (err) {
      this.logger.error('Error validando JWT', err);
      throw new UnauthorizedException('Error validando token');
    }
    if (!user) {
      this.logger.warn('JWT inválido o expirado', info?.message);
      throw new UnauthorizedException('Token inválido o expirado');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return user;
  }
}
