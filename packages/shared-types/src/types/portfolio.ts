import type { IsoDate, IsoTimestamp, Paginated } from './api';
import { AssetType, SipStatus, TransactionStatus, TransactionType } from '../enums';

export interface AssetDto {
  id: string;
  slug: string;
  name: string;
  type: AssetType;
  schemeCode: string | null;
  issuer: string;
  category: string | null;
  navPaise: number;
  navUpdatedAt: IsoTimestamp;
}

export interface NavPoint {
  date: IsoDate;
  navPaise: number;
}

export interface NavSeries {
  assetId: string;
  slug: string;
  points: NavPoint[];
}

/** A single user-asset position. Money fields are integers in paise. */
export interface HoldingDto {
  holdingId: string;
  asset: AssetDto;
  units: string;
  investedPaise: number;
  currentPaise: number;
  gainPaise: number;
  gainPct: number;
  firstPurchaseAt: IsoTimestamp | null;
}

export interface PortfolioSummary {
  userId: string;
  holdings: HoldingDto[];
  investedPaise: number;
  currentPaise: number;
  gainPaise: number;
  gainPct: number;
  /** Annualized return computed via Newton-Raphson XIRR over all cashflows. */
  xirrPct: number | null;
  allocationByType: AllocationSlice[];
}

export interface AllocationSlice {
  type: AssetType;
  currentPaise: number;
  weightPct: number;
}

export interface TransactionDto {
  id: string;
  userId: string;
  asset: Pick<AssetDto, 'id' | 'slug' | 'name' | 'type'>;
  type: TransactionType;
  amountPaise: number;
  units: string;
  navPaise: number;
  status: TransactionStatus;
  idempotencyKey: string | null;
  executedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
}

export interface CreateTransactionInput {
  assetSlug: string;
  type: TransactionType.BUY | TransactionType.SELL;
  /** For BUY: invest in paise; for SELL: redeem in paise (proportional units). */
  amountPaise: number;
  idempotencyKey?: string;
  switchToAssetSlug?: string;
  /** Advisor/Admin executions may target an advised client. */
  targetUserId?: string;
}

export interface SipDto {
  id: string;
  asset: Pick<AssetDto, 'id' | 'slug' | 'name' | 'type'>;
  monthlyAmountPaise: number;
  /** Number of monthly mandate splits, e.g. 3 → three debits per month. */
  intervalsPerMonth: number;
  /** True-ish day numbers (1..31) mapped to actual month length when executing. */
  scheduledDays: number[];
  status: SipStatus;
  startOn: IsoDate;
  endOn: IsoDate | null;
  nextRunOn: IsoDate | null;
}

export type PaginatedTransactions = Paginated<TransactionDto>;
