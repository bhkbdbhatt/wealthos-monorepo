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
} {
  const parsed = new URL(redisUrl);
  const port = Number.parseInt(parsed.port || '6379', 10);
  if (!Number.isFinite(port)) throw new Error(`Invalid REDIS_URL: ${redisUrl}`);
  return { host: parsed.hostname, port };
}
