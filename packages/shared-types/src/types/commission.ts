import { type AssetType, CommissionKind } from '../enums';
import type { IsoDate, IsoTimestamp, Json } from './api';

export interface CommissionCalcInput {
  kind: CommissionKind;
  assetType: AssetType;
  tier: AdvisorTierName;
  /** For UPFRONT: transaction value. For TRAIL: current holding value. Both paise. */
  baseValuePaise: number;
}

export type AdvisorTierName = 'BRONZE' | 'SILVER' | 'GOLD';

/** Result is integer paise, floor-rounded. */
export interface CommissionResult {
  amountPaise: number;
  rateBps: number;
  periodMonth: IsoDate | null;
}

export interface CommissionDto {
  id: string;
  advisorId: string;
  clientId: string;
  transactionId: string | null;
  assetType: AssetType;
  kind: CommissionKind;
  rateBps: number;
  amountPaise: number;
  periodMonth: IsoDate | null;
  createdAt: IsoTimestamp;
  metadata?: Json;
}
