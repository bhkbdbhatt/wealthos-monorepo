import type { IsoTimestamp, Json } from './api';

/**
 * Segment filter AST — a boolean tree over client attributes.
 * Evaluates to SQL WHERE via the segment module's translator.
 */
export type SegmentOperator =
  // scalars
  | 'EQ'
  | 'NEQ'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  // stings
  | 'CONTAINS'
  | 'STARTS_WITH'
  // arrays/lists
  | 'IN'
  | 'NOT_IN'
  // booleans
  | 'IS_TRUE'
  | 'IS_FALSE';

export type SegmentField =
  | 'full_name'
  | 'email'
  | 'current_value_paise'
  | 'invested_paise'
  | 'gain_pct'
  | 'kyc_state'
  | 'asset_types'
  | 'sip_count'
  | 'transaction_count'
  | 'created_at';

export interface SegmentCondition {
  field: SegmentField;
  operator: SegmentOperator;
  /** Value bound to the operator; ignored for IS_TRUE / IS_FALSE. */
  value?: string | number | string[];
}

export interface SegmentConditionGroup {
  combinator: 'AND' | 'OR';
  conditions: SegmentCondition[];
  /** Nested groups are implicitly combined with the same `combinator`. */
  groups?: SegmentConditionGroup[];
}

/** Top-level filter payload persisted as JSON in the `Segment` table. */
export interface SegmentRuleAst {
  root: SegmentConditionGroup;
}

export interface SegmentDto {
  id: string;
  name: string;
  description: string | null;
  rule: SegmentRuleAst;
  createdAt: IsoTimestamp;
}

export interface SegmentPreviewDto {
  estimatedClients: number;
  sampleFullNames: string[];
}

export interface CsvExportMeta {
  filename: string;
  columns: string[];
  rowCount: number;
}
