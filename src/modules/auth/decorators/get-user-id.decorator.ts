import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

export const GetUserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx
      .switchToHttp()
      .getRequest<{ user?: { id?: string; sub?: string } }>();
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('There is no authenticated user');
    }
    return userId;
  },
);
