import { describe, expect, it } from 'vitest';
import { casTextToResult, casTxnFingerprint } from './cas-parser';

const STATEMENT = [
  'Scheme : HDFC Top 200 Fund (HDFC01)',
  '31-Jan-2026  Systematic Purchase  612.345  25.0000  15,308.63',
  '01-Feb-2026  Purchase - NORMAL  1,000.00  24.9532  24,953.20',
  '12-Feb-2026  Redemption  941.742  26.1100  24,585.70',
  '05-Mar-2026  Switch  213.712  27.5331  5,884.10',
  'noise line that must be skipped',
].join('\n');

describe('casTextToResult', () => {
  it('extracts typed transactions with fund metadata', () => {
    const result = casTextToResult(STATEMENT);
    expect(result.transactions).toHaveLength(4);
    expect(result.transactions[0]).toMatchObject({
      fundName: 'HDFC Top 200 Fund',
      schemeCode: 'HDFC01',
      kind: 'SIP',
      dateIso: '2026-01-31',
      units: 612.345,
      nav: 25,
      amount: 15308.63,
    });
    expect(result.transactions.map((txn) => txn.kind)).toEqual([
      'SIP',
      'PURCHASE',
      'REDEMPTION',
      'SWITCH',
    ]);
    expect(result.skippedLines).toHaveLength(1);
  });

  it('filters PII-looking header lines without echoing them', () => {
    const result = casTextToResult('PAN: ABCDE1234F\nEmail: a@b.com\n');
    expect(result.transactions).toHaveLength(0);
    expect(result.skippedLines).toHaveLength(0);
  });

  it('produces stable fingerprints for dedupe', () => {
    const first = casTextToResult(STATEMENT).transactions[0]!;
    const second = casTextToResult(STATEMENT).transactions[0]!;
    expect(casTxnFingerprint(first)).toBe(casTxnFingerprint(second));
    expect(casTxnFingerprint(first)).toContain('2026-01-31');
  });
});
