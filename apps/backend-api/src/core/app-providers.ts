/**
 * App-wide provider map: config token, JWT options factory and Prisma provider
 * binding (used by modules that don't import CoreModule — e2e test modules).
 */
import { PrismaService } from '@wealthos/database';
import { type JwtModuleOptions } from '@nestjs/jwt';
import { type AppConfig, appConfigFactory } from './app-config';
import { PiiCipher } from './pii-cipher';

export const appConfigInjectionToken = 'APP_CONFIG';

export type { AppConfig };
export { appConfigFactory };

export const prismaProvider = {
  provide: PrismaService,
  useClass: PrismaService,
};

export const piiCipherProvider = {
  provide: PiiCipher,
  useFactory: (config: AppConfig): PiiCipher => new PiiCipher(config.piiEncryptionKey),
  inject: [appConfigInjectionToken],
};

export const appJwtModuleOptionsFactory = {
  inject: [appConfigInjectionToken],
  useFactory: (config: AppConfig): JwtModuleOptions => ({
    secret: config.jwtSecret,
    global: true,
  }),
};


