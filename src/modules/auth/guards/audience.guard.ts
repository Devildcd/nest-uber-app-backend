// import {
//   CanActivate,
//   ExecutionContext,
//   Injectable,
//   UnauthorizedException,
// } from '@nestjs/common';
// import { Reflector } from '@nestjs/core';
// import { AUDIENCE_KEY } from '../decorators/audience.decorator';
// import { TokenService } from '../services/token.service';
// import { AppAudience } from '../dto/login.dto';

// @Injectable()
// export class AudienceGuard implements CanActivate {
//   constructor(
//     private reflector: Reflector,
//     private tokens: TokenService,
//   ) {}

//   canActivate(ctx: ExecutionContext): boolean {
//     const expected = this.reflector.getAllAndOverride<
//       AppAudience | AppAudience[]
//     >(AUDIENCE_KEY, [ctx.getHandler(), ctx.getClass()]);
//     if (!expected) return true; // endpoint no marca audiencia

//     const req = ctx.switchToHttp().getRequest<Request & { headers: any }>();
//     const authHeader = req.headers['authorization'] as string | undefined;
//     if (!authHeader?.startsWith('Bearer '))
//       throw new UnauthorizedException('Missing token');

//     const token = authHeader.slice(7);
//     this.tokens.verifyAccessTokenWithAudience(token, expected); // lanza si falla
//     return true;
//   }
// }
