import { describe, expect, it } from 'vitest';
import { nextDebitPlan, splitMonthlyMandate, validateSipSchedule } from './sip-splitter';

describe('splitMonthlyMandate', () => {
  it('splits evenly when divisible', () => {
    expect(splitMonthlyMandate(30_000, 3)).toEqual([10_000, 10_000, 10_000]);
  });

  it('distributes the remainder without losing paise', () => {
    const plan = splitMonthlyMandate(10_001, 3);
    expect(plan.reduce((sum, value) => sum + value, 0)).toBe(10_001);
    expect(plan).toEqual([3334, 3334, 3333]);
  });

  it('rejects non-positive intervals', () => {
    expect(() => splitMonthlyMandate(100, 0)).toThrow();
  });
});

describe('nextDebitPlan', () => {
  it('clamps day 31 into short months', () => {
    const plan = nextDebitPlan(
      {
        startOn: '2026-01-31',
        monthlyAmountPaise: 20_000,
        intervalsPerMonth: 1,
        preferredDays: [31],
        endOn: null,
      },
      3,
    );
    expect(plan.map((point) => point.dateIso)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('schedules multiple anchors per month', () => {
    const plan = nextDebitPlan(
      {
        startOn: '2026-01-01',
        monthlyAmountPaise: 300_000,
        intervalsPerMonth: 3,
        preferredDays: [1, 11, 21],
        endOn: null,
      },
      4,
    );
    expect(plan.map((point) => point.dateIso)).toEqual([
      '2026-01-01',
      '2026-01-11',
      '2026-01-21',
      '2026-02-01',
    ]);
  });

  it('stops at the end date', () => {
    const plan = nextDebitPlan(
      {
        startOn: '2026-01-01',
        monthlyAmountPaise: 100_000,
        intervalsPerMonth: 1,
        preferredDays: [1],
        endOn: '2026-02-15',
      },
      10,
    );
    expect(plan).toHaveLength(2);
  });
});

describe('validateSipSchedule', () => {
  it('returns precise validation errors', () => {
    const errors = validateSipSchedule({
      startOn: '2026-01-01',
      monthlyAmountPaise: 0,
      intervalsPerMonth: 4,
      preferredDays: [1],
    });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('accepts a valid schedule', () => {
    expect(
      validateSipSchedule({
        startOn: '2026-01-01',
        monthlyAmountPaise: 100_000,
        intervalsPerMonth: 2,
        preferredDays: [5, 20],
      }),
    ).toEqual([]);
  });
});
