/** Token TTL constants kept in one place. */
import { type AppConfig } from '../../../core/app-config';

export interface TokenTtlConfig {
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

export function tokenTtlFromConfig(config: AppConfig): TokenTtlConfig {
  return {
    accessExpiresIn: config.jwtExpiresIn,
    refreshExpiresIn: config.jwtRefreshExpiresIn,
  };
}
