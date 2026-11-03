import { Controller, Get, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '@wealthos/database';
import { type JobQueuePort } from './core/queue/queue.port';
import { appConfigInjectionToken, type AppConfig } from './core/app-config';
import { JOB_QUEUE_TOKEN } from './core/queue/queue.providers';
import { Public } from './core/public.decorator';

interface DependencyStatus {
  database: 'ok' | 'unavailable';
  queue: 'ok' | 'unavailable';
}

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JOB_QUEUE_TOKEN) private readonly queue: JobQueuePort,
    @Inject(appConfigInjectionToken) private readonly config: AppConfig,
  ) {}

  @Public()
  @Get()
  status(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Public()
  @Get('live')
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  async readiness(): Promise<{ status: 'ok'; dependencies: DependencyStatus }> {
    const dependencies: DependencyStatus = { database: 'unavailable', queue: 'unavailable' };
    if (this.config.localDemoMode) {
      dependencies.database = 'ok';
    } else {
      try {
        await Promise.race([
          this.prisma.$queryRawUnsafe('SELECT 1'),
          rejectAfter(3000, 'database readiness check timed out'),
        ]);
        dependencies.database = 'ok';
      } catch (error) {
        this.logger.warn(`Database readiness check failed: ${error instanceof Error ? error.name : 'unknown error'}`);
      }
    }
    try {
      if (!this.config.redisUrl) {
        await this.queue.readiness();
        dependencies.queue = 'ok';
      } else {
        await Promise.race([
          this.queue.readiness(),
          rejectAfter(3000, 'queue readiness check timed out'),
        ]);
        dependencies.queue = 'ok';
      }
    } catch (error) {
      this.logger.warn(`Queue readiness check failed: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
    if (dependencies.database !== 'ok' || dependencies.queue !== 'ok') {
      throw new ServiceUnavailableException('Service is not ready');
    }
    return { status: 'ok', dependencies };
  }
}

function rejectAfter(timeoutMs: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), timeoutMs);
  });
}
