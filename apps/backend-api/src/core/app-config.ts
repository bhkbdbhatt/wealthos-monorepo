/** Validated configuration provider for the API — no DTO mystery, all keys mapped. */
import { UserRole } from '@wealthos/shared-types';

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  redisUrl: string | null;
  piiEncryptionKey: string;
  corsOrigins: string[];
  kycMockMode: boolean;
  localDemoMode: boolean;
  requestBodyLimit: string;
  requestTimeoutMs: number;
  shutdownTimeoutMs: number;
}

export const CONFIG_KEYS = {
  port: 'PORT',
  nodeEnv: 'NODE_ENV',
  jwtSecret: 'JWT_SECRET',
  jwtExpiresIn: 'JWT_EXPIRES_IN',
  jwtRefreshSecret: 'JWT_REFRESH_SECRET',
  jwtRefreshExpiresIn: 'JWT_REFRESH_EXPIRES_IN',
  redisUrl: 'REDIS_URL',
  piiEncryptionKey: 'PII_ENCRYPTION_KEY',
  corsOrigins: 'CORS_ORIGIN',
  kycMockMode: 'KYC_MOCK_MODE',
  localDemoMode: 'LOCAL_DEMO_MODE',
  requestBodyLimit: 'REQUEST_BODY_LIMIT',
  requestTimeoutMs: 'REQUEST_TIMEOUT_MS',
  shutdownTimeoutMs: 'SHUTDOWN_TIMEOUT_MS',
} as const;

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

/** Derive AppConfig from process environment; throws early with precise messages. */
export function readAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const redisRaw = env[CONFIG_KEYS.redisUrl];
  const piiKey = env[CONFIG_KEYS.piiEncryptionKey] ?? '';
  if (piiKey.length > 0) {
    const decoded = Buffer.from(piiKey, 'base64');
    if (decoded.length !== 32) {
      throw new Error(
        `${CONFIG_KEYS.piiEncryptionKey} must be base64 of exactly 32 bytes (AES-256)`,
      );
    }
  }
  const jwtSecret = required(env, CONFIG_KEYS.jwtSecret);
  const refreshSecret = required(env, CONFIG_KEYS.jwtRefreshSecret);
  const nodeEnvRaw = env[CONFIG_KEYS.nodeEnv] ?? 'development';
  if (!['development', 'production', 'test'].includes(nodeEnvRaw)) {
    throw new Error(`${CONFIG_KEYS.nodeEnv} must be development|production|test`);
  }
  const portRaw = env[CONFIG_KEYS.port] ?? '4000';
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`${CONFIG_KEYS.port} must be a positive integer`);
  }
  if (nodeEnvRaw === 'production') {
    if (jwtSecret.length < 32 || refreshSecret.length < 32) {
      throw new Error('JWT secrets must be at least 32 chars in production');
    }
    if (piiKey.length === 0) {
      throw new Error(`${CONFIG_KEYS.piiEncryptionKey} is required in production`);
    }
  }
  const corsRaw = env[CONFIG_KEYS.corsOrigins] ?? 'http://localhost:3000,http://localhost:3001';
  const requestTimeoutMs = positiveInteger(env[CONFIG_KEYS.requestTimeoutMs], 30000, CONFIG_KEYS.requestTimeoutMs);
  const shutdownTimeoutMs = positiveInteger(env[CONFIG_KEYS.shutdownTimeoutMs], 30000, CONFIG_KEYS.shutdownTimeoutMs);
  return {
    port,
    nodeEnv: nodeEnvRaw as AppConfig['nodeEnv'],
    jwtSecret,
    jwtExpiresIn: env[CONFIG_KEYS.jwtExpiresIn] ?? '15m',
    jwtRefreshSecret: refreshSecret,
    jwtRefreshExpiresIn: env[CONFIG_KEYS.jwtRefreshExpiresIn] ?? '7d',
    redisUrl: redisRaw ? redisRaw : null,
    piiEncryptionKey: piiKey,
    corsOrigins: corsRaw.split(',').map((s) => s.trim()).filter(Boolean),
    kycMockMode: (env[CONFIG_KEYS.kycMockMode] ?? 'true') === 'true',
    localDemoMode: (env[CONFIG_KEYS.localDemoMode] ?? 'false') === 'true',
    requestBodyLimit: env[CONFIG_KEYS.requestBodyLimit] ?? '1mb',
    requestTimeoutMs,
    shutdownTimeoutMs,
  };
}

function positiveInteger(value: string | undefined, fallback: number, key: string): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
  return parsed;
}

/** ConfigModule factory hook. */
export function appConfigFactory(): AppConfig {
  return readAppConfig(process.env);
}

export const APP_CONFIG_TOKEN = 'APP_CONFIG' as const;
export const appConfigInjectionToken = APP_CONFIG_TOKEN;

/** Roles accepted by the @Roles() guard, mapped 1:1 to UserRole. */
export const API_ROLES = UserRole;
