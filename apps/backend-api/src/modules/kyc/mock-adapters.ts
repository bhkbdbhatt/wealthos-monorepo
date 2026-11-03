/**
 * Mock KYC provider adapters (KYC_MOCK_MODE=true). Real vendors swap in behind
 * the same ports — signatures match production payloads to keep wiring at zero.
 */
import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type PiiCipher } from '../../core/pii-cipher';
import {
  type AadhaarEsignAdapter,
  type DigiLockerAdapter,
  type PanValidationAdapter,
  type VideoKycAdapter,
} from './kyc.ports';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

@Injectable()
export class MockPanValidationAdapter implements PanValidationAdapter {
  constructor(private readonly piiCipher: PiiCipher) {}

  async validate(pan: string): Promise<{ ok: boolean; maskedPan: string; reason?: string }> {
    if (!PAN_REGEX.test(pan)) {
      return { ok: false, maskedPan: '', reason: 'PAN format invalid' };
    }
    return { ok: true, maskedPan: this.piiCipher.mask(this.piiCipher.encrypt(pan), 4, 5) ?? '' };
  }
}

@Injectable()
export class MockDigiLockerAdapter implements DigiLockerAdapter {
  async syncDocuments(userId: string): Promise<{ ok: boolean; docId: string; issuedAt: string }> {
    return {
      ok: true,
      docId: `DL-${createHash('sha256').update(userId, 'utf8').digest('hex').slice(0, 12)}`,
      issuedAt: new Date().toISOString(),
    };
  }
}

@Injectable()
export class MockAadhaarEsignAdapter implements AadhaarEsignAdapter {
  async esign(userId: string, _maskedAadhaar: string): Promise<{ ok: boolean; esignRef: string }> {
    void userId;
    void _maskedAadhaar;
    return { ok: true, esignRef: `ESIGN-${randomUUID()}` };
  }
}

@Injectable()
export class MockVideoKycAdapter implements VideoKycAdapter {
  async schedule(userId: string): Promise<{ ok: boolean; meetingUrl: string; scheduledAt: string }> {
    return {
      ok: true,
      meetingUrl: `https://mock-vkyc.wealthos.dev/session/${encodeURIComponent(userId)}`,
      scheduledAt: new Date().toISOString(),
    };
  }

  async complete(webhookToken: string): Promise<{ ok: boolean; decision: 'APPROVED' | 'REJECTED' }> {
    return { ok: true, decision: webhookToken.endsWith('reject') ? 'REJECTED' : 'APPROVED' };
  }
}
