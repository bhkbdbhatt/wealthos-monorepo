import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'wealthos:is-public';

/**
 * Marks a controller or handler as reachable without a Bearer token.
 * Intended only for login/registration, vendor webhooks and white-label landing
 * pages. Every other route stays protected by the global JwtAuthGuard.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
