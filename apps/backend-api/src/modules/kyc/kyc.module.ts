import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AadhaarEsignAdapter, DigiLockerAdapter, PanValidationAdapter, VideoKycAdapter } from './kyc.ports';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import {
  MockAadhaarEsignAdapter,
  MockDigiLockerAdapter,
  MockPanValidationAdapter,
  MockVideoKycAdapter,
} from './mock-adapters';

/**
 * KYC module — mock adapters bound by default; real vendor modules replace the
 * provider tokens (same ports) once integrations land.
 */
@Module({
  imports: [CoreModule],
  controllers: [KycController],
  providers: [
    { provide: PanValidationAdapter, useClass: MockPanValidationAdapter },
    { provide: DigiLockerAdapter, useClass: MockDigiLockerAdapter },
    { provide: AadhaarEsignAdapter, useClass: MockAadhaarEsignAdapter },
    { provide: VideoKycAdapter, useClass: MockVideoKycAdapter },
    KycService,
  ],
  exports: [KycService],
})
export class KycModule {}
