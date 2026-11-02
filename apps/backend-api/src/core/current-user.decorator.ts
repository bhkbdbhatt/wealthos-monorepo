import {
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { JwtPayload } from '@wealthos/shared-types';

/** Extracts req.user (verified by JwtAuthGuard) for DI-style param injection. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return request.user;
  },
);
