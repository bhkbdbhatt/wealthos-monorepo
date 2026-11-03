/**
 * CAS (Consolidated Account Statement) parser for CAMS/Karvy statements.
 * Works over the *text* of a CAS PDF (extraction done upstream via pdf-parse);
 * the regexes are intentionally pure so tests cover parser logic without a real PDF.
 *
 * Typical CAMS/Karvy transaction lines:
 *   31-Jan-2026  Systematic Purchase  612.345      25.0000     15,421.34
 *   01-Feb-2026  Purchase - NORMAL   1,000.00     24.9532     25,120.00
 *   12-Feb-2026  Redemption          941.742      26.1100     24,585.70
 *   05-Mar-2026  Switch              213.712      27.5331      5,884.10
 */
export interface ParsedCasTransaction {
  /** Fund display name from the CAS header lines above the txn row. */
  fundName: string;
  schemeCode: string | null;
  /** ISO yyyy-MM-dd date of the transaction. */
  dateIso: string;
  /** "PURCHASE" | "REDEMPTION" | "SIP" | "SWITCH" */
  kind: 'PURCHASE' | 'REDEMPTION' | 'SIP' | 'SWITCH';
  units: number;
  nav: number;
  amount: number;
}

export interface CasParseResult {
  transactions: ParsedCasTransaction[];
  /** Human-readable problems per rejected line (never raw PII). */
  skippedLines: Array<{ line: string; reason: string }>;
}

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/** Header/scheme lines look like:  "Scheme : HDFC Top 200 Fund (123ABC)" */
const SCHEME_LINE = /(?:Scheme(?:\s*Name)?\s*:|^)\s*(?<name>[A-Z][^\(]{10,90}?)(?:\s*\((?<code>[A-Z0-9]{4,12})\))?\s*$/;

const TXN_LINE =
  /^(?<date>\d{1,2}-[A-Za-z]{3}-\d{4})\s+(?<desc>[A-Za-z][A-Za-z ()\/\-\.\d]{4,60}?)\s+(?<units>[\d,]+\.\d{2,})\s+(?<nav>[\d,]+\.\d{2,4})\s+(?<amount>[\d,]+\.\d{2})\s*$/;

function classify(desc: string): ParsedCasTransaction['kind'] | null {
  const cleaned = desc.toLowerCase();
  if (cleaned.includes(' redemption')) return 'REDEMPTION';
  if (cleaned.startsWith('redemption')) return 'REDEMPTION';
  if (cleaned.startsWith('switch')) return 'SWITCH';
  if (cleaned.includes('sip') || cleaned.includes('systematic purchase')) return 'SIP';
  if (cleaned.startsWith('purchase') || cleaned.startsWith('systematic')) return 'PURCHASE';
  return null;
}

function parseDate(raw: string): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(raw);
  if (!m) return null;
  const day = Number.parseInt(m[1] as string, 10);
  const monthKey = (m[2] as string).toUpperCase();
  if (!(monthKey in MONTHS)) return null;
  const month = MONTHS[monthKey] as number;
  const year = Number.parseInt(m[3] as string, 10);
  const d = new Date(Date.UTC(year, month, day));
  if (d.getUTCDate() !== day) return null;
  return d.toISOString().slice(0, 10);
}

function toNumber(raw: string): number {
  return Number.parseFloat(raw.replace(/,/g, ''));
}

export function casParagraphToTransactions(paragraph: string): ParsedCasTransaction[] {
  if (paragraph.trim().length === 0) return [];
  const result = casTextToResult(paragraph);
  if (result.skippedLines.length > 0) {
    throw new Error(`CAS paragraph parse rejected lines: ${result.skippedLines[0]?.reason ?? 'unknown'}`);
  }
  return result.transactions;
}

/** Parse full statement text: returns all valid txns with skip reasons for unusable lines. */
export function casTextToResult(text: string): CasParseResult {
  const lines = text.split(/\r?\n/);
  let currentFund = 'Unknown Fund';
  let currentCode: string | null = null;
  const transactions: ParsedCasTransaction[] = [];
  const skippedLines: CasParseResult['skippedLines'] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const schemeMatch = SCHEME_LINE.exec(line);
    if (schemeMatch?.groups?.['name']) {
      currentFund = schemeMatch.groups['name'].trim();
      currentCode = schemeMatch.groups['code'] ?? null;
      continue;
    }
    if (/^(?:Consolidated|Kin:|PAN:|Address:|Email:|Mobile:)/i.test(line)) {
      continue; // PII-bearing wrapping lines are discarded, never echoed
    }
    const txnMatch = TXN_LINE.exec(line);
    if (!txnMatch?.groups) {
      skippedLines.push({ line: '<<unparsed line>>', reason: 'no match' });
      continue;
    }
    const kind = classify(txnMatch.groups['desc'] ?? '');
    const dateIso = parseDate(txnMatch.groups['date'] ?? '');
    if (kind === null || dateIso === null) {
      skippedLines.push({ line: '<<unparsed line>>', reason: kind === null ? 'unknown txn type' : 'bad date' });
      continue;
    }
    transactions.push({
      fundName: currentFund,
      schemeCode: currentCode,
      dateIso,
      kind,
      units: toNumber(txnMatch.groups['units'] ?? ''),
      nav: toNumber(txnMatch.groups['nav'] ?? ''),
      amount: toNumber(txnMatch.groups['amount'] ?? ''),
    });
  }
  return { transactions, skippedLines };
}

/**
 * Deduplication key: fund + date + tx-type + amount + units.
 * Re-uploads produce identical rows; keys emitted here power the guard.
 */
export function casTxnFingerprint(t: ParsedCasTransaction): string {
  return [
    t.fundName,
    t.schemeCode ?? '_',
    t.dateIso,
    t.kind,
    Math.round(t.amount * 100), // paise fingerprint
    Math.round(t.units * 1e5),
  ].join('|');
}
