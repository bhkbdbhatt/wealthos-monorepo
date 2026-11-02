import { type Provider } from '@nestjs/common';
import { type AppConfig, appConfigInjectionToken } from './app-config';
import { PiiCipher } from './pii-cipher';

export const piiCipherProvider: Provider = {
  provide: PiiCipher,
  useFactory: (config: AppConfig): PiiCipher => new PiiCipher(config.piiEncryptionKey),
  inject: [appConfigInjectionToken],
};
