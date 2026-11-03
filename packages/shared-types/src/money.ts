/**
 * Money formatting utilities. All WealthOS amounts travel as integers in paise
 * — these helpers exist ONLY at presentation boundaries.
 */

const PAISE_PER_RUPEE = 100;

export interface FormatOptions {
  /** Prepend the ₹ glyph. */
  symbol?: boolean;
  /** Indian digit grouping (1,00,000.00) vs western (100,000.00). Default: Indian. */
  indianGrouping?: boolean;
}

/** Convert integer paise to floating rupees (formatting only — never persisted). */
export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

/** Rupees to integer paise; rounds half up and asserts integrality of input. */
export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) throw new RangeError('rupees must be finite');
  return Math.round(rupees * PAISE_PER_RUPEE);
}

/** "125000" → "1,25,000" using South-Asian 3-2-2 grouping. */
export function groupIndianDigits(intPart: string): string {
  if (intPart.length <= 3) return intPart;
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const restGrouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${restGrouped},${last3}`;
}

/** Format paise integer into a human string; paise shown only when non-zero. */
export function formatPaise(paise: number, opts: FormatOptions = {}): string {
  if (!Number.isInteger(paise)) throw new RangeError('formatPaise expects integer paise');
  const { symbol = false, indianGrouping = true } = opts;
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / PAISE_PER_RUPEE);
  const paiseRemainder = abs % PAISE_PER_RUPEE;
  const rupeeStr = indianGrouping
    ? groupIndianDigits(String(rupees))
    : rupees.toLocaleString('en-US');
  const body =
    paiseRemainder === 0
      ? rupeeStr
      : `${rupeeStr}.${String(paiseRemainder).padStart(2, '0')}`;
  const sign = negative ? '-' : '';
  const sym = symbol ? '₹' : '';
  return `${sign}${sym}${body}`;
}

/** Compact display for dashboards: ₹1.25 Cr / ₹45.6 L / ₹8.4 k. */
export function formatPaiseCompact(paise: number): string {
  if (!Number.isInteger(paise)) throw new RangeError('formatPaiseCompact expects integer paise');
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const crore = abs / 1_000_000_000;
  const lakh = abs / 10_000_000;
  const thousand = abs / 100_000;
  if (crore >= 1) return `${sign}₹${crore.toFixed(2)} Cr`;
  if (lakh >= 1) return `${sign}₹${lakh.toFixed(1)} L`;
  if (thousand >= 1) return `${sign}₹${thousand.toFixed(1)} k`;
  return `${sign}${formatPaise(abs)}`;
}
