import { describe, expect, it } from 'vitest';
import type { SegmentRuleAst } from '@wealthos/shared-types';
import { matchesSegment, type ClientSegmentRow } from './segment-eval';

const row: ClientSegmentRow = {
  id: 'client-1',
  full_name: 'Asha Rao',
  email: 'asha@example.com',
  current_value_paise: 2_000_000,
  invested_paise: 1_500_000,
  gain_pct: 33.33,
  kyc_state: 'COMPLETED',
  asset_types: ['MUTUAL_FUND', 'EQUITY'],
  sip_count: 2,
  transaction_count: 9,
  created_at: '2025-04-01T00:00:00.000Z',
};

function rule(ast: SegmentRuleAst['root']): SegmentRuleAst {
  return { root: ast };
}

describe('matchesSegment', () => {
  it('evaluates numeric filters', () => {
    expect(
      matchesSegment(
        row,
        rule({ combinator: 'AND', conditions: [{ field: 'current_value_paise', operator: 'GT', value: 1_500_000 }] }),
      ),
    ).toBe(true);
  });

  it('supports nested OR groups', () => {
    const ast = rule({
      combinator: 'AND',
      conditions: [{ field: 'kyc_state', operator: 'EQ', value: 'COMPLETED' }],
      groups: [
        {
          combinator: 'OR',
          conditions: [
            { field: 'asset_types', operator: 'IN', value: ['EQUITY'] },
            { field: 'sip_count', operator: 'GTE', value: 5 },
          ],
        },
      ],
    });
    expect(matchesSegment(row, ast)).toBe(true);
  });

  it('supports string contains and case-insensitive matching', () => {
    expect(
      matchesSegment(
        row,
        rule({ combinator: 'AND', conditions: [{ field: 'email', operator: 'CONTAINS', value: 'EXAMPLE' }] }),
      ),
    ).toBe(true);
  });

  it('rejects non-matching rows', () => {
    expect(
      matchesSegment(
        row,
        rule({ combinator: 'AND', conditions: [{ field: 'kyc_state', operator: 'EQ', value: 'INITIATED' }] }),
      ),
    ).toBe(false);
  });
});
