import { type Provider } from '@nestjs/common';
import { type AppConfig, appConfigInjectionToken } from '../app-config';
import { type JobQueuePort } from './queue.port';
import { createQueueAdapter } from './queue.factory';

/** Queue adapter picked once at boot: BullMQ(REDIS_URL) or in-memory fallback. */
export const queueProvider: Provider = {
  provide: 'JOB_QUEUE',
  useFactory: (config: AppConfig): JobQueuePort => createQueueAdapter(config),
  inject: [appConfigInjectionToken],
};

export const JOB_QUEUE_TOKEN = 'JOB_QUEUE';
