import { type AssetType, KycState } from '../enums';
import type { IsoDate, IsoTimestamp, Json } from './api';

export interface BasketItemDto {
  asset: { id: string; slug: string; name: string; type: AssetType };
  targetWeightPct: number;
}

export interface BasketDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  items: BasketItemDto[];
}

export interface GoalDto {
  id: string;
  name: string;
  targetAmountPaise: number;
  horizonMonths: number;
  expectedAnnualReturnBps: number;
  recommendedMonthlyPaise: number;
  currentValuePaise: number;
  startDate: IsoDate;
  progressPct: number;
  achieved: boolean;
}

export interface CreateGoalInput {
  name: string;
  targetAmountPaise: number;
  horizonMonths: number;
  expectedAnnualReturnBps: number;
}

export type CasParserVersion = 'cams-v1' | 'karvy-v1';

export interface CasUploadDto {
  id: string;
  fileName: string;
  sizeBytes: number;
  parserVersion: CasParserVersion;
  status: 'PROCESSING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  transactionsImported: number;
  duplicatesSkipped: number;
  errorDetails: Json | null;
  createdAt: IsoTimestamp;
}

export const ALL_KYC_STATES: readonly KycState[] = [
  KycState.INITIATED,
  KycState.PAN_VALIDATED,
  KycState.DIGILOCKER_SYNCED,
  KycState.AADHAAR_ESIGNED,
  KycState.VIDEO_KYC_PENDING,
  KycState.COMPLETED,
] as const;

export interface XirrCashflow {
  date: IsoDate;
  /** Negative = money invested (outflow), positive = money redeemed (inflow). */
  amountPaise: number;
}
