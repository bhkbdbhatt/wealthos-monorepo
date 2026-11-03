import { describe, expect, it } from 'vitest';
import { xirr, xirrPct } from './xirr';

describe('xirr', () => {
  it('solves a simple one-year 10% return', () => {
    const rate = xirr([
      { date: '2025-01-01', amount: -100_000 },
      { date: '2026-01-01', amount: 110_000 },
    ]);
    expect(rate).not.toBeNull();
    expect(rate as number).toBeCloseTo(0.09531, 4);
    expect(xirrPct([
      { date: '2025-01-01', amount: -100_000 },
      { date: '2026-01-01', amount: 110_000 },
    ])).toBeCloseTo(9.53, 1);
  });

  it('returns null without both inflow and outflow', () => {
    expect(xirr([{ date: '2025-01-01', amount: -100 }])).toBeNull();
    expect(
      xirr([
        { date: '2025-01-01', amount: 100 },
        { date: '2026-01-01', amount: 200 },
      ]),
    ).toBeNull();
  });

  it('rejects invalid dates', () => {
    expect(() =>
      xirr([
        { date: 'not-a-date', amount: -100 },
        { date: '2026-01-01', amount: 110 },
      ]),
    ).toThrow(/Invalid cashflow date/);
  });
});
