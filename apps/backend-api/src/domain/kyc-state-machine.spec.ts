import { describe, expect, it } from 'vitest';
import { KycState } from '@wealthos/shared-types';
import { applyKycEvent, canTransition, isIdempotentReapply } from './kyc-state-machine';

describe('KYC state machine', () => {
  it('walks the happy path in order', () => {
    let state: KycState = KycState.INITIATED;
    state = applyKycEvent(state, 'PAN_VALIDATED') as KycState;
    state = applyKycEvent(state, 'DIGILOCKER_SYNCED') as KycState;
    state = applyKycEvent(state, 'AADHAAR_ESIGNED') as KycState;
    state = applyKycEvent(state, 'VIDEO_KYC_SCHEDULED') as KycState;
    state = applyKycEvent(state, 'VIDEO_KYC_COMPLETED') as KycState;
    expect(state).toBe(KycState.COMPLETED);
  });

  it('rejects out-of-order events', () => {
    expect(applyKycEvent(KycState.INITIATED, 'VIDEO_KYC_COMPLETED')).toBeNull();
    expect(applyKycEvent(KycState.COMPLETED, 'PAN_REJECTED')).toBeNull();
  });

  it('treats repeated adapter callbacks as idempotent', () => {
    expect(isIdempotentReapply(KycState.PAN_VALIDATED, 'PAN_VALIDATED')).toBe(true);
    expect(isIdempotentReapply(KycState.DIGILOCKER_SYNCED, 'DIGILOCKER_SYNCED')).toBe(true);
  });

  it('validates single-step transitions', () => {
    expect(canTransition(KycState.INITIATED, KycState.PAN_VALIDATED)).toBe(true);
    expect(canTransition(KycState.PAN_VALIDATED, KycState.INITIATED)).toBe(false);
    expect(canTransition(KycState.VIDEO_KYC_PENDING, KycState.INITIATED)).toBe(true);
  });
});
