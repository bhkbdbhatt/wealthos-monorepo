/**
 * Segment filter translation: SegmentRuleAst → parameterized SQL WHERE fragment
 * evaluated over a canonical per-client aggregate row (defined by the analytics
 * SQL in the segments repository). All literals are bound as $n params.
 *
 * Canonical aggregated row columns (plain):
 *   full_name, email, kyc_state, sip_count, transaction_count,
 *   current_value_paise, invested_paise, gain_pct, asset_types(text[]), created_at
 */
import {
  type SegmentCondition,
  type SegmentConditionGroup,
  type SegmentOperator,
} from '@wealthos/shared-types';

export interface WhereFragment {
  sql: string;
  params: unknown[];
}

const FIELD_COLUMN: Record<string, string> = {
  full_name: 'full_name',
  email: 'email',
  current_value_paise: 'current_value_paise',
  invested_paise: 'invested_paise',
  gain_pct: 'gain_pct',
  kyc_state: 'kyc_state',
  sip_count: 'sip_count',
  transaction_count: 'transaction_count',
  created_at: 'created_at',
};

export const SEGMENT_FIELDS = Object.keys(FIELD_COLUMN) as SegmentField[];

type SegmentField = keyof typeof FIELD_COLUMN;

const OPERATOR_SQL: Partial<Record<SegmentOperator, string>> = {
  EQ: '=',
  NEQ: '<>',
  GT: '>',
  GTE: '>=',
  LT: '<',
  LTE: '<=',
};

export interface SegmentAstError {
  path: string;
  message: string;
}

export interface SegmentTranslation {
  fragment: WhereFragment | null;
  errors: SegmentAstError[];
}

export function translateSegmentAst(ast: SegmentConditionGroup): SegmentTranslation {
  const params: unknown[] = [];
  const errors: SegmentAstError[] = [];
  const sql = translateGroup(ast, params, errors, 'root');
  if (sql === null) return { fragment: null, errors };
  return { fragment: { sql, params }, errors };
}

function translateGroup(
  group: SegmentConditionGroup,
  params: unknown[],
  errors: SegmentAstError[],
  path: string,
): string | null {
  if (!group.conditions.length && !group.groups?.length) {
    errors.push({ path, message: 'Group must have conditions or nested groups' });
    return null;
  }
  const joiner = group.combinator === 'AND' ? ' AND ' : ' OR ';
  if (!['AND', 'OR'].includes(group.combinator as string)) {
    errors.push({ path, message: `Unknown combinator: ${String(group.combinator)}` });
    return null;
  }
  const parts: string[] = [];
  group.conditions.forEach((c, i) => {
    const fragment = conditionToSql(c, params, errors, `${path}.conditions[${i}]`);
    if (fragment !== null) parts.push(fragment);
  });
  group.groups?.forEach((g, i) => {
    const nested = translateGroup(g, params, errors, `${path}.groups[${i}]`);
    if (nested !== null) parts.push(`(${nested})`);
  });
  if (parts.length === 0) return null;
  return parts.join(joiner).length > 1 ? `(${parts.join(joiner)})` : parts.join(joiner);
}

function conditionToSql(
  condition: SegmentCondition,
  params: unknown[],
  errors: SegmentAstError[],
  path: string,
): string | null {
  const column = FIELD_COLUMN[condition.field];
  if (!column) {
    errors.push({ path, message: `Unknown field ${String(condition.field)}` });
    return null;
  }
  switch (condition.operator) {
    case 'IS_TRUE':
      return `${column} = TRUE`;
    case 'IS_FALSE':
      return `${column} = FALSE`;
    case 'CONTAINS':
    case 'STARTS_WITH':
      return textPattern(column, condition.operator, condition.value, params, path, errors);
    case 'IN':
    case 'NOT_IN':
      return inList(column, condition.operator, condition.value, params, path, errors, condition.field === 'asset_types');
    case 'EQ':
    case 'NEQ':
    case 'GT':
    case 'GTE':
    case 'LT':
    case 'LTE': {
      const op = OPERATOR_SQL[condition.operator] as string;
      const target = condition.field === 'created_at' ? `::timestamptz` : '';
      return `${column} ${op} $${bind(condition.value, params)}${target}`;
    }
    default: {
      errors.push({ path, message: `Unsupported operator: ${(condition.operator as string)}` });
      return null;
    }
  }
}

function textPattern(
  column: string,
  operator: 'CONTAINS' | 'STARTS_WITH',
  value: unknown,
  params: unknown[],
  path: string,
  errors: SegmentAstError[],
): string | null {
  if (typeof value !== 'string') {
    errors.push({ path, message: `${operator} expects a string value` });
    return null;
  }
  const pattern = operator === 'CONTAINS' ? `%${value}%` : `${value}%`;
  return `${column} ILIKE $${bind(pattern, params)}`;
}

function inList(
  column: string,
  operator: 'IN' | 'NOT_IN',
  value: unknown,
  params: unknown[],
  path: string,
  errors: SegmentAstError[],
  arrayColumn: boolean,
): string | null {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ path, message: `${operator} expects a non-empty array` });
    return null;
  }
  const op = operator === 'IN' ? (arrayColumn ? '= ANY(' : ' IN (') : (arrayColumn ? 'IS DISTINCT FROM (' : ' NOT IN (');
  const index = params.push(value) - 1;
  void path;
  return arrayColumn
    ? `${column} ${op}$${index + 1})`
    : `${column} ${op}$${index + 1})`;
}

function bind(value: unknown, params: unknown[]): number {
  params.push(value);
  return params.length;
}
