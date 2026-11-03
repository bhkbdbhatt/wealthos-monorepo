import { describe, expect, it } from 'vitest';
import { parseConnection } from './queue.factory';

describe('parseConnection', () => {
  it('preserves Redis authentication and database selection', () => {
    expect(parseConnection('redis://wealthos:p%40ss@redis.internal:6380/2'))
      .toEqual({
        host: 'redis.internal',
        port: 6380,
        username: 'wealthos',
        password: 'p@ss',
        db: 2,
        tls: undefined,
      });
  });

  it('enables TLS for rediss URLs', () => {
    expect(parseConnection('rediss://redis.internal:6380').tls).toEqual({});
  });

  it('rejects unsupported Redis protocols', () => {
    expect(() => parseConnection('http://redis.internal:6379'))
      .toThrow('Invalid REDIS_URL protocol: http:');
  });
});
