import { SetMetadata } from '@nestjs/common';
import { type UserRole } from '@wealthos/shared-types';

export const ROLES_KEY = 'wealthos:roles';

/**
 * Usage: @Roles(UserRole.ADVISOR, UserRole.ADMIN)
 * Semantics: any listed role passes. ADMIN is additionally evaluated inside
 * JwtAuthGuard, so listing only ADVISOR keeps admins out unless listed.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
