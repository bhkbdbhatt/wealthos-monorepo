import { describe, expect, it } from 'vitest';
import { goalProgress, recommendMonthlySip } from './goal-planner';

describe('recommendMonthlySip', () => {
  it('uses simple division when return is zero', () => {
    expect(
      recommendMonthlySip({
        targetAmountPaise: 12_000_000,
        horizonMonths: 12,
        expectedAnnualReturnBps: 0,
      }),
    ).toEqual({ recommendedMonthlyPaise: 1_000_000, monthlyRate: 0 });
  });

  it('recommends less monthly for a positive expected return', () => {
    const withReturns = recommendMonthlySip({
      targetAmountPaise: 10_000_000,
      horizonMonths: 60,
      expectedAnnualReturnBps: 1200,
    });
    const withoutReturns = recommendMonthlySip({
      targetAmountPaise: 10_000_000,
      horizonMonths: 60,
      expectedAnnualReturnBps: 0,
    });
    expect(withReturns.recommendedMonthlyPaise).toBeLessThan(
      withoutReturns.recommendedMonthlyPaise,
    );
    expect(Number.isInteger(withReturns.recommendedMonthlyPaise)).toBe(true);
  });

  it('validates inputs', () => {
    expect(() =>
      recommendMonthlySip({ targetAmountPaise: 0, horizonMonths: 12, expectedAnnualReturnBps: 0 }),
    ).toThrow();
    expect(() =>
      recommendMonthlySip({ targetAmountPaise: 100, horizonMonths: 0, expectedAnnualReturnBps: 0 }),
    ).toThrow();
  });
});

describe('goalProgress', () => {
  it('reports progress and completion', () => {
    expect(goalProgress(500_000, 1_000_000)).toEqual({ progressPct: 50, achieved: false });
    expect(goalProgress(1_200_000, 1_000_000)).toEqual({ progressPct: 120, achieved: true });
  });
});
