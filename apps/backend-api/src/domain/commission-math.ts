/**
 * Commission math — integer paise only.
 * Upfront: transaction_value × upfront_rate (one-time, at purchase)
 * Trail:  current_holding_value × trail_rate / 12 (monthly)
 * Rates come from the shared COMMISSION_RATE_BPS table (bps).
 */
import { COMMISSION_RATE_BPS } from '@wealthos/shared-types';
import { type AssetType, CommissionKind, type AdvisorTierName } from '@wealthos/shared-types';

export interface CommissionComputation {
  kind: CommissionKind;
  rateBps: number;
  /** Floor-rounded integer paise. */
  amountPaise: number;
  /** up-front: null; trail: ISO "yyyy-MM". */
  periodMonth: string | null;
}

export function rateBpsFor(assetType: AssetType, kind: CommissionKind, tier: AdvisorTierName): number {
  const table = COMMISSION_RATE_BPS[assetType] as
    | Record<CommissionKind, Record<AdvisorTierName, number>>
    | undefined;
  if (!table) throw new Error(`No commission rate table for asset ${assetType}`);
  return table[kind][tier];
}

/** Naive divison into paise, guaranteed integer; floor ensures we never overpay advisors. */
function floorBps(baseValuePaise: number, rateBps: number): number {
  return Math.floor((baseValuePaise * rateBps) / 10_000);
}

export function computeCommission(
  kind: CommissionKind,
  assetType: AssetType,
  tier: AdvisorTierName,
  baseValuePaise: number,
  /** For trail: month the credit belongs to ("yyyy-MM"). */
  trailPeriodMonth?: string,
): CommissionComputation {
  if (baseValuePaise < 0) throw new Error('Commission base cannot be negative');
  const rateBps = rateBpsFor(assetType, kind, tier);
  if (kind === CommissionKind.UPFRONT) {
    return { kind, rateBps, amountPaise: floorBps(baseValuePaise, rateBps), periodMonth: null };
  }
  if (!trailPeriodMonth || !/^\d{4}-\d{2}$/.test(trailPeriodMonth)) {
    throw new Error('Trail commission requires a yyyy-MM period month');
  }
  const monthly = floorBps(baseValuePaise, rateBps) / 12;
  const paise = Math.floor(monthly);
  return { kind, rateBps, amountPaise: paise, periodMonth: trailPeriodMonth };
}

/** Unused-parameter-free overload for pure MRR rollups. */
export function monthlyRecurringRevenuePaise(trailAmountsPaise: number[]): number {
  return trailAmountsPaise.reduce((sum, v) => sum + v, 0);
}
