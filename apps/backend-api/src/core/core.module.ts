import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '@wealthos/database';
import { piiCipherProvider } from './pii.providers';
import { queueProvider } from './queue/queue.providers';
import {
  appConfigFactory,
  appConfigInjectionToken,
  appJwtModuleOptionsFactory,
} from './app-providers';

/**
 * Shared infrastructure module — every feature module imports this to get
 * PrismaService (DB), PiiCipher (AES-256-GCM) and the JobQueuePort cleanly.
 */
@Module({
  imports: [JwtModule.registerAsync(appJwtModuleOptionsFactory)],
  providers: [
    PrismaService,
    { provide: appConfigInjectionToken, useFactory: appConfigFactory },
    piiCipherProvider,
    queueProvider,
  ],
  exports: [
    JwtModule,
    PrismaService,
    appConfigInjectionToken,
    piiCipherProvider,
    queueProvider,
  ],
})
export class CoreModule {}
