'use client';

import { useState } from 'react';
import type {
  SegmentCondition,
  SegmentDto,
  SegmentField,
  SegmentOperator,
  SegmentPreviewDto,
  SegmentRuleAst,
} from '@wealthos/shared-types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorBanner,
  Input,
  Label,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  Th,
} from '@wealthos/ui-core';
import { ApiError, apiFetch, downloadCsv } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

interface DraftCondition {
  id: string;
  field: SegmentField;
  operator: SegmentOperator;
  value: string;
}

const FIELD_LABELS: Record<SegmentField, string> = {
  full_name: 'Client name',
  email: 'Email',
  current_value_paise: 'Portfolio value (INR)',
  invested_paise: 'Invested value (INR)',
  gain_pct: 'Gain %',
  kyc_state: 'KYC state',
  asset_types: 'Held asset classes',
  sip_count: 'Live SIP count',
  transaction_count: 'Transaction count',
  created_at: 'Onboarded on/before',
};

const MONEY_FIELDS: SegmentField[] = ['current_value_paise', 'invested_paise'];
const NUMBER_FIELDS: SegmentField[] = [
  'current_value_paise',
  'invested_paise',
  'gain_pct',
  'sip_count',
  'transaction_count',
];
const LIST_FIELDS: SegmentField[] = ['asset_types', 'kyc_state'];

const OPERATORS: Array<{ value: SegmentOperator; label: string }> = [
  { value: 'GT', label: 'greater than' },
  { value: 'GTE', label: 'at least' },
  { value: 'LT', label: 'less than' },
  { value: 'LTE', label: 'at most' },
  { value: 'EQ', label: 'equals' },
  { value: 'NEQ', label: 'not equals' },
  { value: 'CONTAINS', label: 'contains' },
  { value: 'STARTS_WITH', label: 'starts with' },
  { value: 'IN', label: 'is one of' },
  { value: 'NOT_IN', label: 'is not one of' },
];

function newCondition(field: SegmentField = 'current_value_paise'): DraftCondition {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    field,
    operator: NUMBER_FIELDS.includes(field) ? 'GTE' : 'EQ',
    value: '',
  };
}

function parseValue(condition: DraftCondition): string | number | string[] {
  const raw = condition.value.trim();
  if (LIST_FIELDS.includes(condition.field) || condition.operator === 'IN' || condition.operator === 'NOT_IN') {
    return raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (MONEY_FIELDS.includes(condition.field)) {
    const rupees = Number(raw);
    return Number.isFinite(rupees) ? Math.round(rupees * 100) : raw;
  }
  if (NUMBER_FIELDS.includes(condition.field)) {
    const value = Number(raw);
    return Number.isFinite(value) ? value : raw;
  }
  return raw;
}

function buildRule(combinator: 'AND' | 'OR', conditions: DraftCondition[]): SegmentRuleAst {
  const mapped: SegmentCondition[] = conditions.map((condition) => ({
    field: condition.field,
    operator: condition.operator,
    value: parseValue(condition),
  }));
  return { root: { combinator, conditions: mapped } };
}

export default function SegmentsPage() {
  const { data: segments, error, loading, reload } = useApiData<SegmentDto[]>('/segments');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [combinator, setCombinator] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<DraftCondition[]>([newCondition()]);
  const [preview, setPreview] = useState<SegmentPreviewDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function updateCondition(id: string, patch: Partial<DraftCondition>): void {
    setConditions((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function changeField(id: string, field: SegmentField): void {
    updateCondition(id, {
      field,
      operator: NUMBER_FIELDS.includes(field) ? 'GTE' : 'EQ',
      value: '',
    });
  }

  async function runPreview(): Promise<void> {
    setBusy(true);
    setFormError(null);
    try {
      const result = await apiFetch<SegmentPreviewDto>('/segments/preview', {
        method: 'POST',
        body: JSON.stringify({ rule: buildRule(combinator, conditions) }),
      });
      setPreview(result);
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : 'Could not preview this segment');
    } finally {
      setBusy(false);
    }
  }

  async function saveSegment(): Promise<void> {
    setBusy(true);
    setFormError(null);
    try {
      await apiFetch<SegmentDto>('/segments', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: description.trim() || undefined,
          rule: buildRule(combinator, conditions),
        }),
      });
      setName('');
      setDescription('');
      setConditions([newCondition()]);
      setPreview(null);
      reload();
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : 'Could not save this segment');
    } finally {
      setBusy(false);
    }
  }

  async function removeSegment(id: string): Promise<void> {
    setFormError(null);
    try {
      await apiFetch<{ deleted: true }>(`/segments/${id}`, { method: 'DELETE' });
      reload();
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : 'Could not delete this segment');
    }
  }

  async function exportSegment(id: string, segmentName: string): Promise<void> {
    setFormError(null);
    try {
      await downloadCsv(`/segments/${id}/export`, `${segmentName.replace(/\s+/g, '-')}.csv`);
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : 'Could not export this segment');
    }
  }

  return (
    <div>
      <PageHeader
        title="Client segments"
        description="Combine portfolio, KYC and activity rules, preview the audience, then save or export."
      />
      <ErrorBanner message={error ?? formError} />
      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Rule builder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="segment-name">Segment name</Label>
                <Input
                  id="segment-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="High-value KYC-ready clients"
                />
              </div>
              <div>
                <Label htmlFor="segment-description">Description</Label>
                <Input
                  id="segment-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional internal note"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Label className="mb-0">Match</Label>
              <Select
                value={combinator}
                onChange={(event) => setCombinator(event.target.value as 'AND' | 'OR')}
                className="w-28"
                aria-label="Condition combinator"
              >
                <option value="AND">ALL (AND)</option>
                <option value="OR">ANY (OR)</option>
              </Select>
              <span className="text-sm text-slate-500">of the following rules</span>
            </div>
            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div key={condition.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
                    <Select
                      value={condition.field}
                      onChange={(event) => changeField(condition.id, event.target.value as SegmentField)}
                      aria-label={`Field for rule ${index + 1}`}
                    >
                      {Object.entries(FIELD_LABELS).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={condition.operator}
                      onChange={(event) =>
                        updateCondition(condition.id, {
                          operator: event.target.value as SegmentOperator,
                        })
                      }
                      aria-label={`Operator for rule ${index + 1}`}
                    >
                      {OPERATORS.map((operator) => (
                        <option key={operator.value} value={operator.value}>
                          {operator.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      value={condition.value}
                      onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
                      placeholder={
                        MONEY_FIELDS.includes(condition.field)
                          ? 'Amount in INR'
                          : LIST_FIELDS.includes(condition.field)
                            ? 'Comma-separated values'
                            : 'Value'
                      }
                      aria-label={`Value for rule ${index + 1}`}
                    />
                    <Button
                      variant="ghost"
                      onClick={() => setConditions((items) => items.filter((item) => item.id !== condition.id))}
                      aria-label={`Remove rule ${index + 1}`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setConditions((items) => [...items, newCondition()])}>
                Add rule
              </Button>
              <Button variant="secondary" onClick={() => void runPreview()} disabled={busy || conditions.length === 0}>
                Preview audience
              </Button>
              <Button onClick={() => void saveSegment()} disabled={busy || name.trim().length < 2 || conditions.length === 0}>
                Save segment
              </Button>
            </div>
            {preview ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">
                  {preview.estimatedClients} matching clients
                </p>
                <p className="mt-1 text-sm text-emerald-800">
                  {preview.sampleFullNames.length > 0
                    ? `Sample: ${preview.sampleFullNames.join(', ')}`
                    : 'No client currently matches this rule.'}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Saved segments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center gap-3 p-5 text-sm text-slate-500">
                <Spinner /> Loading saved segments...
              </div>
            ) : segments && segments.length > 0 ? (
              <Table className="border-0 shadow-none">
                <thead>
                  <tr>
                    <Th>Segment</Th>
                    <Th>Created</Th>
                    <Th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {segments.map((segment) => (
                    <tr key={segment.id}>
                      <Td>
                        <p className="font-medium text-slate-900">{segment.name}</p>
                        <p className="text-xs text-slate-500">
                          {segment.description ?? `${segment.rule.root.conditions.length} conditions`}
                        </p>
                      </Td>
                      <Td>{formatDate(segment.createdAt)}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="text-xs font-medium text-emerald-700"
                            onClick={() => void exportSegment(segment.id, segment.name)}
                          >
                            CSV
                          </button>
                          <button
                            type="button"
                            className="text-xs font-medium text-red-600"
                            onClick={() => void removeSegment(segment.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <div className="p-5 text-sm text-slate-500">
                <Badge tone="info">No segments yet</Badge>
                <p className="mt-3">Build your first rule and save it to reuse or export.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
