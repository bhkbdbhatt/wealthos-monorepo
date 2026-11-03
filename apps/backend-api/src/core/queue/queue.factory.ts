import { type AppConfig } from '../app-config';
import { InMemoryQueueAdapter, RedisQueueAdapter, type JobQueuePort } from './queue.port';

/** Selects the queue adapter based on configured REDIS_URL. */
export function createQueueAdapter(config: Pick<AppConfig, 'nodeEnv' | 'redisUrl'>): JobQueuePort {
  if (config.redisUrl) {
    return new RedisQueueAdapter(parseConnection(config.redisUrl));
  }
  return new InMemoryQueueAdapter();
}

export function parseConnection(redisUrl: string): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: object;
} {
  const parsed = new URL(redisUrl);
  const port = Number.parseInt(parsed.port || '6379', 10);
  if (!Number.isFinite(port)) throw new Error(`Invalid REDIS_URL: ${redisUrl}`);
  if (!['redis:', 'rediss:'].includes(parsed.protocol)) {
    throw new Error(`Invalid REDIS_URL protocol: ${parsed.protocol}`);
  }
  const db = parsed.pathname === '/' || parsed.pathname === '' ? undefined : Number(parsed.pathname.slice(1));
  if (db !== undefined && (!Number.isSafeInteger(db) || db < 0)) {
    throw new Error('Invalid Redis database in REDIS_URL');
  }
  return {
    host: parsed.hostname,
    port,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}
