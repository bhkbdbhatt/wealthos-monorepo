/**
 * In-memory evaluation of a SegmentRuleAst against a canonical client aggregate.
 * Keeping this pure means the same rule can be previewed, saved, exported and
 * evaluated in unit tests without touching Postgres.
 */
import {
  type SegmentCondition,
  type SegmentConditionGroup,
  type SegmentRuleAst,
} from '@wealthos/shared-types';

export interface ClientSegmentRow {
  id: string;
  full_name: string;
  email: string;
  current_value_paise: number;
  invested_paise: number;
  gain_pct: number;
  kyc_state: string;
  asset_types: string[];
  sip_count: number;
  transaction_count: number;
  created_at: string;
}

function compareNumbers(left: number, right: number, operator: SegmentCondition['operator']): boolean {
  switch (operator) {
    case 'EQ':
      return left === right;
    case 'NEQ':
      return left !== right;
    case 'GT':
      return left > right;
    case 'GTE':
      return left >= right;
    case 'LT':
      return left < right;
    case 'LTE':
      return left <= right;
    default:
      return false;
  }
}

function asNumber(value: SegmentCondition['value']): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function asString(value: SegmentCondition['value']): string | null {
  return typeof value === 'string' ? value : null;
}

function asArray(value: SegmentCondition['value']): string[] | null {
  return Array.isArray(value) ? value : null;
}

/** @returns true when the condition matches the aggregate row. */
export function matchesCondition(row: ClientSegmentRow, condition: SegmentCondition): boolean {
  const raw = row[condition.field as keyof ClientSegmentRow] as unknown;
  switch (condition.operator) {
    case 'IS_TRUE':
      return raw === true;
    case 'IS_FALSE':
      return raw === false;
    case 'CONTAINS': {
      const needle = asString(condition.value);
      if (needle === null || typeof raw !== 'string') return false;
      return raw.toLowerCase().includes(needle.toLowerCase());
    }
    case 'STARTS_WITH': {
      const needle = asString(condition.value);
      if (needle === null || typeof raw !== 'string') return false;
      return raw.toLowerCase().startsWith(needle.toLowerCase());
    }
    case 'IN':
    case 'NOT_IN': {
      const values = asArray(condition.value);
      if (values === null) return false;
      const haystack = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      const hit = values.some((value) => haystack.includes(value));
      return condition.operator === 'IN' ? hit : !hit;
    }
    default: {
      if (typeof raw === 'number') {
        const target = asNumber(condition.value);
        return target === null ? false : compareNumbers(raw, target, condition.operator);
      }
      if (typeof raw === 'string') {
        const target = asString(condition.value);
        if (target === null) return false;
        if (condition.operator === 'EQ') return raw === target;
        if (condition.operator === 'NEQ') return raw !== target;
        return compareNumbers(Date.parse(raw), Date.parse(target), condition.operator);
      }
      return false;
    }
  }
}

/** @returns true when every relevant branch of the group matches. */
export function matchesGroup(row: ClientSegmentRow, group: SegmentConditionGroup): boolean {
  const conditionResults = group.conditions.map((condition) => matchesCondition(row, condition));
  const groupResults = (group.groups ?? []).map((nested) => matchesGroup(row, nested));
  const results = [...conditionResults, ...groupResults];
  if (results.length === 0) return true;
  return group.combinator === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

/** @returns true when the full persisted rule matches the row. */
export function matchesSegment(row: ClientSegmentRow, rule: SegmentRuleAst): boolean {
  return matchesGroup(row, rule.root);
}
