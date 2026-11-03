const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 2,
});

const pct = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Format integer paise as Indian rupees.
 * @param paise integer paise
 * @returns display string
 */
export function formatMoney(paise: number): string {
  return inr.format(paise / 100);
}

/**
 * Format integer paise compactly for cards and charts.
 * @param paise integer paise
 * @returns display string
 */
export function formatCompactMoney(paise: number): string {
  return compact.format(paise / 100);
}

/**
 * Format a numeric percentage.
 * @param value percentage value
 * @returns display string with percent suffix
 */
export function formatPct(value: number | null): string {
  if (value === null) return '-';
  return `${pct.format(value)}%`;
}

/**
 * Format an ISO date for Indian readers.
 * @param value ISO date or timestamp
 * @returns display date
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

/**
 * Human label for a SCREAMING_SNAKE enum value.
 * @param value enum string
 * @returns title-cased label
 */
export function label(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Generate initials for an avatar placeholder.
 * @param name full name
 * @returns up to two initials
 */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/**
 * Parse a rupee input into integer paise.
 * @param value user-entered rupees
 * @returns integer paise, or NaN when invalid
 */
export function rupeesToPaise(value: string): number {
  const rupees = Number(value);
  return Number.isFinite(rupees) ? Math.round(rupees * 100) : Number.NaN;
}
