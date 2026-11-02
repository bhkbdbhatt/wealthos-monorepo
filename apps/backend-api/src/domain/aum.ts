/**
 * AUM and portfolio math — pure functions over integer paise.
 * AUM = Σ (current_units × current_NAV)
 */
import { type AllocationSlice, type AssetType } from '@wealthos/shared-types';

export interface HoldingRow {
  units: number; // Decimal via string conversion upstream
  investedPaise: number;
  assetId: string;
  assetType: AssetType;
  currentNavPaise: number;
}

export interface AumTotals {
  investedPaise: number;
  currentPaise: number;
  gainPaise: number;
  gainPct: number;
}

export function holdingCurrentPaise(h: HoldingRow): number {
  return Math.round(h.units * h.currentNavPaise);
}

export function aumTotals(holdings: HoldingRow[]): AumTotals {
  const invested = holdings.reduce((s, h) => s + h.investedPaise, 0);
  const current = holdings.reduce((s, h) => s + holdingCurrentPaise(h), 0);
  const gain = current - invested;
  const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
  return { investedPaise: invested, currentPaise: current, gainPaise: gain, gainPct: round2(gainPct) };
}

export function allocationSlices(holdings: HoldingRow[]): AllocationSlice[] {
  const currentTotal = holdings.reduce((s, h) => s + holdingCurrentPaise(h), 0);
  const byType = new Map<AssetType, number>();
  for (const h of holdings) {
    byType.set(h.assetType, (byType.get(h.assetType) ?? 0) + holdingCurrentPaise(h));
  }
  return [...byType.entries()].map(([type, currentPaise]) => ({
    type,
    currentPaise,
    weightPct: currentTotal > 0 ? round2((currentPaise / currentTotal) * 100) : 0,
  }));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function clampPct(n: number): number {
  return Math.max(-100, Math.min(100, round2(n)));
}
