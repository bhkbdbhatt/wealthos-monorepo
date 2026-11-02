import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@wealthos/shared-types';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

/**
 * Verifies the Bearer JWT and composes with @Roles() for RBAC.
 * Rejects unknown/missing tokens outright; implicit role derivation is never used.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const authHeader = (request['headers'] as Record<string, string> | undefined)?.['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    const token = authHeader.slice('Bearer '.length);
    let payload: Record<string, unknown>;
    try {
      payload = this.jwtService.verify<Record<string, unknown>>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    const principal = toPrincipal(payload);
    request['user'] = principal;
    if (!requiredRoles || requiredRoles.length === 0) return true;
    const isAdminBypass = requiredRoles.includes(UserRole.ADMIN);
    if (isAdminBypass && principal.role === UserRole.ADMIN) return true;
    if (requiredRoles.includes(principal.role)) return true;
    throw new ForbiddenException(`Role ${principal.role} may not access this resource`);
  }
}

function toPrincipal(payload: Record<string, unknown>): {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
} {
  const sub = payload['sub'];
  const email = payload['email'];
  const role = payload['role'];
  if (typeof sub !== 'string' || typeof email !== 'string' || typeof role !== 'string') {
    throw new UnauthorizedException('Malformed token payload');
  }
  if (role !== UserRole.ADMIN && role !== UserRole.ADVISOR && role !== UserRole.CLIENT) {
    throw new UnauthorizedException('Unknown role in token');
  }
  return {
    sub,
    email,
    role: role as UserRole,
    iat: typeof payload['iat'] === 'number' ? payload['iat'] : undefined,
    exp: typeof payload['exp'] === 'number' ? payload['exp'] : undefined,
  };
}
