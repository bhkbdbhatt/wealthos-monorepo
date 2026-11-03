import { describe, expect, it } from 'vitest';
import { AssetType } from '@wealthos/shared-types';
import { aumTotals, allocationSlices, clampPct, holdingCurrentPaise } from './aum';

const holdings = [
  {
    assetId: 'a',
    assetType: AssetType.MUTUAL_FUND,
    units: 100.5,
    investedPaise: 100_000,
    currentNavPaise: 1_200,
  },
  {
    assetId: 'b',
    assetType: AssetType.EQUITY,
    units: 20,
    investedPaise: 50_000,
    currentNavPaise: 3_000,
  },
];

describe('aum math', () => {
  it('values a holding with integer paise rounding', () => {
    expect(holdingCurrentPaise(holdings[0]!)).toBe(120_600);
  });

  it('totals invested, current and gain', () => {
    const totals = aumTotals(holdings);
    expect(totals.investedPaise).toBe(150_000);
    expect(totals.currentPaise).toBe(180_600);
    expect(totals.gainPaise).toBe(30_600);
    expect(totals.gainPct).toBe(20.4);
  });

  it('builds allocation slices that sum to 100%', () => {
    const slices = allocationSlices(holdings);
    expect(slices).toHaveLength(2);
    expect(slices.reduce((sum, slice) => sum + slice.weightPct, 0)).toBeCloseTo(100, 1);
  });

  it('clamps extreme percentages for display', () => {
    expect(clampPct(250)).toBe(100);
    expect(clampPct(-250)).toBe(-100);
  });
});
