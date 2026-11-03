import { Logger } from '@nestjs/common';
import { Queue as BullQueue, type ConnectionOptions } from 'bullmq';

/**
 * Queue abstraction used by application services so domain flows never depend
 * on BullMQ directly. Chosen adapter:
 *  - RedisQueueAdapter when REDIS_URL is set (production parity)
 *  - InMemoryQueueAdapter otherwise (local dev without Docker)
 */

export interface RepeatJobSpec {
  /** BullMQ-style repeatability key. */
  everyMs?: number;
  cron?: string;
}

export interface EnqueueOptions {
  repeat?: RepeatJobSpec;
  delayMs?: number;
}

export interface EnqueuedJob {
  id: string | undefined;
  name: string;
}

export interface JobQueuePort {
  enqueue<TPayload>(queueName: string, payload: TPayload, opts?: EnqueueOptions): Promise<EnqueuedJob>;
  readiness(): Promise<void>;
  close(): Promise<void>;
}

const logger = new Logger('InMemoryQueueAdapter');

export class InMemoryQueueAdapter implements JobQueuePort {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Runs handlers synchronously-ish via setTimeout — only for dev. */
  async enqueue<TPayload>(
    queueName: string,
    payload: TPayload,
    opts?: EnqueueOptions,
  ): Promise<EnqueuedJob> {
    const delay = opts?.delayMs ?? 0;
    const id = `mem:${queueName}:${Date.now()}:${Math.floor(Math.random() * 1e6)}`;
    const timer = setTimeout(() => {
      logger.log(`(in-memory queue "${queueName}") payload processed: ${safeCount(payload)}`);
      this.timers.delete(id);
    }, delay);
    this.timers.set(id, timer);
    return { id, name: queueName };
  }

  async readiness(): Promise<void> {
    return Promise.resolve();
  }

  async close(): Promise<void> {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}

function safeCount(payload: unknown): string {
  return typeof payload === 'object' && payload !== null ? 'object' : String(payload);
}

export class RedisQueueAdapter implements JobQueuePort {
  private readonly queues = new Map<string, BullQueue>();

  constructor(private readonly connection: ConnectionOptions) {}

  private queue(name: string): BullQueue {
    const existing = this.queues.get(name);
    if (existing) return existing;
    const created = new BullQueue(name, { connection: this.connection });
    this.queues.set(name, created);
    return created;
  }

  async enqueue<TPayload>(
    queueName: string,
    payload: TPayload,
    opts?: EnqueueOptions,
  ): Promise<EnqueuedJob> {
    const q = this.queue(queueName);
    const repeat = opts?.repeat
      ? opts.repeat.cron
        ? { pattern: opts.repeat.cron }
        : opts.repeat.everyMs
          ? { every: opts.repeat.everyMs }
          : undefined
      : undefined;
    const job = await q.add(queueName, payload as Record<string, unknown>, {
      delay: opts?.delayMs,
      repeat,
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    return { id: job.id?.toString(), name: queueName };
  }

  readiness(): Promise<void> {
    const queue = this.queue('__wealthos_health__');
    return queue.client.then(() => undefined);
  }

  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    this.queues.clear();
  }
}

/** Queue names used across modules — single source of truth. */
export const QUEUE_NAMES = {
  NAV_REFRESH: 'nav-refresh',
  SIP_DEBITS: 'sip-debits',
  TRAIL_COMMISSION: 'trail-commission',
  LEAD_NOTIFICATION: 'lead-notification',
} as const;
