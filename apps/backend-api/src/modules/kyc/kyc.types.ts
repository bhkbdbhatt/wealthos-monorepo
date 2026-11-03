import { type KycState, type KycEventKind } from '@wealthos/shared-types';

export interface PrismaKycRecord {
  id: string;
  userId: string;
  state: KycState;
  panMasked: string | null;
  rejectionReason: string | null;
  updatedAt: Date;
}

export type { KycState, KycEventKind };
