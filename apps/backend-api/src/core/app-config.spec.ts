import { describe, expect, it } from 'vitest';
import { readAppConfig } from './app-config';

describe('readAppConfig resilience settings', () => {
  const baseEnv: NodeJS.ProcessEnv = {
    JWT_SECRET: 'development-access-secret-at-least-32-characters',
    JWT_REFRESH_SECRET: 'development-refresh-secret-at-least-32-characters',
  };

  it('uses bounded production defaults', () => {
    const config = readAppConfig(baseEnv);
    expect(config.requestBodyLimit).toBe('1mb');
    expect(config.requestTimeoutMs).toBe(30000);
    expect(config.shutdownTimeoutMs).toBe(30000);
  });

  it('accepts positive timeout overrides', () => {
    const config = readAppConfig({
      ...baseEnv,
      REQUEST_TIMEOUT_MS: '45000',
      SHUTDOWN_TIMEOUT_MS: '15000',
      REQUEST_BODY_LIMIT: '2mb',
    });
    expect(config.requestTimeoutMs).toBe(45000);
    expect(config.shutdownTimeoutMs).toBe(15000);
    expect(config.requestBodyLimit).toBe('2mb');
  });

  it('rejects invalid timeout overrides', () => {
    expect(() => readAppConfig({ ...baseEnv, REQUEST_TIMEOUT_MS: '0' }))
      .toThrow('REQUEST_TIMEOUT_MS must be a positive integer');
  });
});
