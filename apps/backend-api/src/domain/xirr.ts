/**
 * XIRR — Newton–Raphson iterative solver for IRR with irregular cash flows.
 * Spec: tolerance 1e-7, max 100 iterations, initial guess 0.1.
 * Cashflow sign convention: negative = money invested (outflow), positive = money
 * received back (inflow). Returns annualized rate as a decimal, or null if no
 * convergence / invalid inputs (all-same-sign flows never converge — that is
 * mathematically correct, not an error to swallow).
 */
export interface XirrFlow {
  date: string | Date;
  /** Negative = invested, positive = returned. Amounts in any consistent unit. */
  amount: number;
}

const EPSILON = 1e-7;
const MAX_ITERATIONS = 100;
const INITIAL_GUESS = 0.1;

function toTime(value: string | Date): number {
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(t)) throw new Error(`Invalid cashflow date: ${String(value)}`);
  return t;
}

export function xirr(flows: XirrFlow[]): number | null {
  if (flows.length < 2) return null;
  const sorted = [...flows].map((f) => ({ t: toTime(f.date), amt: f.amount })).sort((a, b) => a.t - b.t);
  const spend = sorted.some((f) => f.amt < 0);
  const earn = sorted.some((f) => f.amt > 0);
  if (!spend || !earn) return null;
  const t0 = sorted[0]!.t;
  const yearsOf = (t: number): number => (t - t0) / (365 * 24 * 3600 * 1000);

  let guess = INITIAL_GUESS;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let npv = 0;
    let dNpv = 0;
    for (const f of sorted) {
      const y = yearsOf(f.t);
      const e = Math.exp(-guess * y);
      npv += f.amt * e;
      dNpv += -y * f.amt * e;
    }
    if (dNpv === 0) return null;
    const next = guess - npv / dNpv;
    if (!Number.isFinite(next)) return null;
    if (Math.abs(next - guess) < EPSILON) {
      // Verify the converged root actually zeroes NPV.
      let check = 0;
      for (const f of sorted) {
        check += f.amt * Math.exp(-next * yearsOf(f.t));
      }
      if (Math.abs(check) < EPSILON * Math.max(1, Math.abs(check))) return next;
      return null;
    }
    guess = next;
  }
  return null;
}

/** Convenience: rate in percent, rounded to 2dp — presentation only. */
export function xirrPct(flows: XirrFlow[]): number | null {
  const value = xirr(flows);
  if (value === null) return null;
  return Math.round(value * 10000) / 100;
}
