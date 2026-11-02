/**
 * SIP scheduling math (multi-day mandate splitting):
 * A monthly mandate of M paise split into N units → M/N per debit, scheduled on
 * configured day-of-month anchors with graceful end-of-month clamping (day 31 →
 * last day of short months). Pure functions; BullMQ workers stay thin.
 */
import { SIP_SPLIT_OPTIONS } from '@wealthos/shared-types';

export interface SipScheduleRequest {
  /** ISO "yyyy-MM-dd" anchor, usually today or chosen start date. */
  startOn: string;
  monthlyAmountPaise: number;
  intervalsPerMonth: number;
  /** Preferred day anchors 1..31 per debit; must match intervalsPerMonth length. */
  preferredDays: number[];
  /** Optional horizons; null = no end. */
  endOn?: string | null;
}

export interface SipDebitPoint {
  dateIso: string;
  amountPaise: number;
}

function clampToMonthLength(year: number, month0: number, day: number): number {
  const last = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  return Math.min(day, last);
}

export function validateSipSchedule(request: SipScheduleRequest): string[] {
  const errors: string[] = [];
  if (!SIP_SPLIT_OPTIONS.includes(request.intervalsPerMonth as 1 | 2 | 3)) {
    errors.push(`intervalsPerMonth must be one of ${SIP_SPLIT_OPTIONS.join(', ')}`);
  }
  if (request.monthlyAmountPaise <= 0) errors.push('monthlyAmountPaise must be positive');
  if (request.preferredDays.length !== request.intervalsPerMonth) {
    errors.push(`preferredDays must contain exactly ${request.intervalsPerMonth} day anchors`);
  }
  if (request.preferredDays.some((d) => d < 1 || d > 31)) {
    errors.push('preferredDays must be within 1..31');
  }
  return errors;
}

/** Split the monthly mandate into the per-debit plan. */
export function splitMonthlyMandate(monthlyAmountPaise: number, intervalsPerMonth: number): number[] {
  if (intervalsPerMonth <= 0) throw new Error('intervalsPerMonth must be >= 1');
  const each = Math.floor(monthlyAmountPaise / intervalsPerMonth);
  const plan = new Array<number>(intervalsPerMonth).fill(each);
  let remainder = monthlyAmountPaise - each * intervalsPerMonth;
  for (let i = 0; remainder > 0; i = (i + 1) % intervalsPerMonth) {
    plan[i] = plan[i] + 1;
    remainder--;
  }
  return plan;
}

/** Next N debit points starting at the first anchor ≥ startOn. */
export function nextDebitPlan(request: SipScheduleRequest, count: number): SipDebitPoint[] {
  const amounts = splitMonthlyMandate(request.monthlyAmountPaise, request.intervalsPerMonth);
  const [y, m, d] = request.startOn.split('-').map((s) => Number.parseInt(s, 10));
  const results: SipDebitPoint[] = [];
  let cursorYear = y as number;
  let cursorMonth = (m as number) - 1;
  let anchorIndex = (request.preferredDays as number[]).findIndex((day) => {
    const clamped = clampToMonthLength(cursorYear, cursorMonth, day as number);
    return clamped >= (d as number);
  });
  if (anchorIndex === -1) {
    // roll to next month's first anchor
    cursorMonth += 1;
    if (cursorMonth > 11) {
      cursorMonth = 0;
      cursorYear += 1;
    }
    anchorIndex = 0;
  }
  while (results.length < count) {
    if (request.endOn) {
      const [ey, em, ed] = request.endOn.split('-').map((s) => Number.parseInt(s, 10));
      const eo = Date.UTC(ey as number, (em as number) - 1, ed as number);
      const day = (request.preferredDays[anchorIndex] as number);
      const clamped = clampToMonthLength(cursorYear, cursorMonth, day);
      if (Date.UTC(cursorYear, cursorMonth, clamped) > eo) break;
    }
    const day = (request.preferredDays[anchorIndex] as number);
    const clamped = clampToMonthLength(cursorYear, cursorMonth, day);
    results.push({
      dateIso: `${String(cursorYear).padStart(4, '0')}-${String(cursorMonth + 1).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`,
      amountPaise: amounts[anchorIndex] as number,
    });
    anchorIndex += 1;
    if (anchorIndex >= request.intervalsPerMonth) {
      anchorIndex = 0;
      cursorMonth += 1;
      if (cursorMonth > 11) {
        cursorMonth = 0;
        cursorYear += 1;
      }
    }
  }
  return results;
}

/** nextRunOn for persistence: first debit point strictly after `afterIso`. */
export function nextRunAfter(
  afterIso: string,
  request: SipScheduleRequest,
): string | null {
  return nextDebitPlan(request, 24).map((p) => p.dateIso).find((d) => d > afterIso) ?? null;
}
