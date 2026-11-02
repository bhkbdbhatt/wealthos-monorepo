import { Module } from '@nestjs/common';
import { PrismaService } from '@wealthos/database';
import { piiCipherProvider } from './pii.providers';
import { queueProvider } from './queue/queue.providers';

/**
 * Shared infrastructure module — every feature module imports this to get
 * PrismaService (DB), PiiCipher (AES-256-GCM) and the JobQueuePort cleanly.
 */
@Module({
  providers: [PrismaService, piiCipherProvider, queueProvider],
  exports: [PrismaService, piiCipherProvider, queueProvider],
})
export class CoreModule {}
