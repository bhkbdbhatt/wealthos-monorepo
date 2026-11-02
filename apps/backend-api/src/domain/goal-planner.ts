/**
 * Goal planner (Module C2): target + horizon → recommended monthly investment.
 * Standard future-value annuity math over integer paise with bps rates.
 *
 *   target = monthly × ((1+r)^n − 1)/r × (1+r) for annuity-due
 *   → monthly = target / (((1+r)^n − 1)/r) when aligning to ordinary annuity
 * at spec level we use ordinary annuity (end-of-month debit, matching SIP flows).
 */
export interface GoalPlanningInput {
  targetAmountPaise: number;
  horizonMonths: number;
  /** Annualized expected return in basis points, e.g. 1200 = 12% p.a. */
  expectedAnnualReturnBps: number;
}

export interface GoalPlanningOutput {
  recommendedMonthlyPaise: number;
  monthlyRate: number;
}

export function roundUp(value: number): number {
  return Math.max(1, Math.ceil(value));
}

/** Monthly SIP recommendation in integer paise, rounded up. */
export function recommendMonthlySip(input: GoalPlanningInput): GoalPlanningOutput {
  if (input.horizonMonths <= 0) throw new Error('horizonMonths must be positive');
  if (input.targetAmountPaise <= 0) throw new Error('targetAmountPaise must be positive');
  const r = input.expectedAnnualReturnBps / 1_200_000; // monthly rate
  const n = input.horizonMonths;
  if (r === 0) {
    return { recommendedMonthlyPaise: roundUp(input.targetAmountPaise / n), monthlyRate: 0 };
  }
  const factor = (Math.pow(1 + r, n) - 1) / r;
  return { recommendedMonthlyPaise: roundUp(input.targetAmountPaise / factor), monthlyRate: r };
}

/** Live progress against a goal from actual holdings; no persistence required. */
export function goalProgress(
  currentValuePaise: number,
  targetAmountPaise: number,
): { progressPct: number; achieved: boolean } {
  if (targetAmountPaise <= 0) throw new Error('Target must be positive');
  const progressPct = Math.min(133, Math.round((currentValuePaise / targetAmountPaise) * 10000) / 100);
  const achieved = currentValuePaise >= targetAmountPaise;
  return { progressPct, achieved };
}
