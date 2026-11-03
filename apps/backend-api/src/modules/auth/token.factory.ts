import { type JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { type UserRole, type JwtPayload } from '@wealthos/shared-types';
import { type AppConfig } from '../../core/app-config';
import { tokenTtlFromConfig } from './token-ttl';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

/**
 * Signs access (short-lived, main secret) and refresh (long-lived, refresh
 * secret) tokens. Different secrets mean a leaked access token cannot mint
 * refresh tokens.
 */
export class TokenFactory {
  private readonly ttl: ReturnType<typeof tokenTtlFromConfig>;
  private readonly refreshSecret: string;

  constructor(
    private readonly jwt: JwtService,
    config: AppConfig,
  ) {
    this.ttl = tokenTtlFromConfig(config);
    this.refreshSecret = config.jwtRefreshSecret;
  }

  /** Access-token TTL in seconds for client timers. */
  accessTtlSeconds(): number {
    const match = /^(\d+)([smhd])$/.exec(this.ttl.accessExpiresIn);
    if (!match) return 15 * 60;
    const value = Number.parseInt(match[1] as string, 10);
    const unit = match[2] as 's' | 'm' | 'h' | 'd';
    const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86_400;
    return value * multiplier;
  }

  /**
   * @param user row subset needed for claims; role must be an ISO enum value string.
   */
  signPair(user: { id: string; email: string; role: string }): TokenPair {
    const principal: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
    };
    const accessToken = this.jwt.sign(principal, {
      expiresIn: this.ttl.accessExpiresIn as JwtSignOptions['expiresIn'],
    });
    const refreshToken = this.jwt.sign(principal, {
      secret: this.refreshSecret,
      expiresIn: this.ttl.refreshExpiresIn as JwtSignOptions['expiresIn'],
    });
    return { accessToken, refreshToken, expiresInSeconds: this.accessTtlSeconds() };
  }

  /** Fails closed on tamper/expiry/structural drift. */
  verifyRefresh(refreshToken: string): { ok: true; payload: JwtPayload } | { ok: false } {
    try {
      const payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
      if (typeof payload?.sub !== 'string' || typeof payload?.email !== 'string') {
        return { ok: false };
      }
      return { ok: true, payload };
    } catch {
      return { ok: false };
    }
  }
}
