/**
 * KYC state machine — guarded transitions only.
 * INITIATED → PAN_VALIDATED → DIGILOCKER_SYNCED → AADHAAR_ESIGNED →
 * VIDEO_KYC_PENDING → COMPLETED
 * Reject reasons are explicit; completed is terminal forward (only reversal =
 * back to INITIATED via REJECTED event, modeled as below).
 */
import { KycState } from '@wealthos/shared-types';

export type KycEvent = {
  event:
    | 'PAN_VALIDATED'
    | 'PAN_REJECTED'
    | 'DIGILOCKER_SYNCED'
    | 'AADHAAR_ESIGNED'
    | 'VIDEO_KYC_SCHEDULED'
    | 'VIDEO_KYC_COMPLETED'
    | 'KYC_REJECTED'
    | 'KYC_COMPLETED';
  meta?: Record<string, unknown>;
};

export interface KycTransition {
  from: KycState;
  to: KycState;
}

const PAN_MAP: Record<KycState, KycState | null> = {
  [KycState.INITIATED]: KycState.PAN_VALIDATED,
  [KycState.PAN_VALIDATED]: KycState.PAN_VALIDATED,
  [KycState.DIGILOCKER_SYNCED]: KycState.DIGILOCKER_SYNCED,
  [KycState.AADHAAR_ESIGNED]: KycState.AADHAAR_ESIGNED,
  [KycState.VIDEO_KYC_PENDING]: KycState.VIDEO_KYC_PENDING,
  [KycState.COMPLETED]: KycState.COMPLETED,
};

/** Transition table: event + current state → next state or null if illegal. */
export function applyKycEvent(current: KycState, event: KycEvent['event']): KycState | null {
  switch (event) {
    case 'PAN_VALIDATED': {
      if (current === KycState.INITIATED) return KycState.PAN_VALIDATED;
      if (current === KycState.PAN_VALIDATED) return KycState.PAN_VALIDATED;
      return null;
    }
    case 'PAN_REJECTED': {
      if (current !== KycState.COMPLETED) return KycState.INITIATED;
      return null;
    }
    case 'DIGILOCKER_SYNCED': {
      if (current === KycState.PAN_VALIDATED) return KycState.DIGILOCKER_SYNCED;
      if (current === KycState.DIGILOCKER_SYNCED) return KycState.DIGILOCKER_SYNCED;
      return null;
    }
    case 'AADHAAR_ESIGNED': {
      if (current === KycState.DIGILOCKER_SYNCED) return KycState.AADHAAR_ESIGNED;
      if (current === KycState.AADHAAR_ESIGNED) return KycState.AADHAAR_ESIGNED;
      return null;
    }
    case 'VIDEO_KYC_SCHEDULED': {
      if (current === KycState.AADHAAR_ESIGNED) return KycState.VIDEO_KYC_PENDING;
      if (current === KycState.VIDEO_KYC_PENDING) return KycState.VIDEO_KYC_PENDING;
      return null;
    }
    case 'VIDEO_KYC_COMPLETED':
    case 'KYC_COMPLETED': {
      if (current === KycState.VIDEO_KYC_PENDING) return KycState.COMPLETED;
      return null;
    }
    case 'KYC_REJECTED': {
      if (current === KycState.VIDEO_KYC_PENDING || current === KycState.AADHAAR_ESIGNED) {
        return KycState.INITIATED;
      }
      return null;
    }
    default:
      return null;
  }
}

/** Chain-validation helper used by services to assert monotonic progress. */
export function canTransition(current: KycState, to: KycState): boolean {
  const order = [
    KycState.INITIATED,
    KycState.PAN_VALIDATED,
    KycState.DIGILOCKER_SYNCED,
    KycState.AADHAAR_ESIGNED,
    KycState.VIDEO_KYC_PENDING,
    KycState.COMPLETED,
  ];
  const ci = order.indexOf(current);
  const ti = order.indexOf(to);
  if (ci === -1 || ti === -1) return false;
  // Backwards is never allowed; same state is a no-op → false.
  return ti === ci + 1 || (to === KycState.INITIATED && current === KycState.VIDEO_KYC_PENDING);
}

/** Idempotency helper: many adapter events land twice; same-state transitions are no-ops. */
export function isIdempotentReapply(current: KycState, event: KycEvent['event']): boolean {
  return PAN_MAP[current] === applyKycEvent(current, event);
}

export const KYC_STATE_ORDER = [
  KycState.INITIATED,
  KycState.PAN_VALIDATED,
  KycState.DIGILOCKER_SYNCED,
  KycState.AADHAAR_ESIGNED,
  KycState.VIDEO_KYC_PENDING,
  KycState.COMPLETED,
] as const;
