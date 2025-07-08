import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const GetUserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ user?: { sub?: string } }>();
    const sub = req.user?.sub;
    if (!sub) {
      throw new UnauthorizedException('There is no authenticated user');
    }
    return sub;
  },
);
