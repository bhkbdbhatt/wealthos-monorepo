import { describe, expect, it } from 'vitest';
import { AssetType, CommissionKind } from '@wealthos/shared-types';
import { computeCommission, monthlyRecurringRevenuePaise, rateBpsFor } from './commission-math';

describe('commission math', () => {
  it('computes upfront MF gold commission in paise', () => {
    const result = computeCommission(CommissionKind.UPFRONT, AssetType.MUTUAL_FUND, 'GOLD', 1_000_000);
    expect(result.rateBps).toBe(150);
    expect(result.amountPaise).toBe(15_000);
    expect(result.periodMonth).toBeNull();
  });

  it('computes monthly trail with floor division', () => {
    const result = computeCommission(
      CommissionKind.TRAIL,
      AssetType.MUTUAL_FUND,
      'GOLD',
      1_000_000,
      '2026-03',
    );
    expect(result.rateBps).toBe(80);
    expect(result.amountPaise).toBe(666);
    expect(result.periodMonth).toBe('2026-03');
  });

  it('requires a month for trail', () => {
    expect(() =>
      computeCommission(CommissionKind.TRAIL, AssetType.MUTUAL_FUND, 'GOLD', 1_000_000),
    ).toThrow(/yyyy-MM/);
  });

  it('exposes the shared rate table', () => {
    expect(rateBpsFor(AssetType.INSURANCE, CommissionKind.UPFRONT, 'SILVER')).toBe(150);
  });

  it('sums MRR amounts as integers', () => {
    expect(monthlyRecurringRevenuePaise([100, 250, 650])).toBe(1000);
  });
});
