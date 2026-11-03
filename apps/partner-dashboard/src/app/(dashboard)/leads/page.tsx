'use client';

import { useMemo, useState } from 'react';
import { LeadStatus, type LeadDto } from '@wealthos/shared-types';
import {
  Badge,
  ErrorBanner,
  PageHeader,
  Select,
  Spinner,
  Table,
  Td,
  Th,
  type BadgeTone,
} from '@wealthos/ui-core';
import { ApiError, apiFetch } from '@/lib/api';
import { formatDate, label } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

const TONES: Record<LeadStatus, BadgeTone> = {
  [LeadStatus.NEW]: 'info',
  [LeadStatus.CONTACTED]: 'warning',
  [LeadStatus.CONVERTED]: 'success',
  [LeadStatus.LOST]: 'neutral',
};

export default function LeadsPage() {
  const { data, error, loading, reload } = useApiData<LeadDto[]>('/partners/leads');
  const [filter, setFilter] = useState<'ALL' | LeadStatus>('ALL');
  const [actionError, setActionError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (!data) return [];
    return filter === 'ALL' ? data : data.filter((lead) => lead.status === filter);
  }, [data, filter]);

  async function updateStatus(id: string, status: LeadStatus): Promise<void> {
    setUpdating(id);
    setActionError(null);
    try {
      await apiFetch<LeadDto>(`/partners/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      reload();
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : 'Could not update this lead');
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Lead inbox"
        description="Every enquiry from your public partner page, newest first."
        actions={
          <Select
            value={filter}
            onChange={(event) => setFilter(event.target.value as 'ALL' | LeadStatus)}
            aria-label="Filter by lead status"
            className="w-44"
          >
            <option value="ALL">All statuses</option>
            {Object.values(LeadStatus).map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </Select>
        }
      />
      <ErrorBanner message={error ?? actionError} />
      {loading ? (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Spinner /> Loading leads...
        </div>
      ) : visible.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>Lead</Th>
              <Th>Message</Th>
              <Th>Received</Th>
              <Th>Status</Th>
              <Th>Move to</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((lead) => (
              <tr key={lead.id}>
                <Td>
                  <p className="font-medium text-slate-900">{lead.name}</p>
                  <p className="text-xs text-slate-500">{lead.phone}</p>
                  {lead.email ? <p className="text-xs text-slate-500">{lead.email}</p> : null}
                </Td>
                <Td className="max-w-xs text-sm text-slate-600">{lead.message ?? '-'}</Td>
                <Td>{formatDate(lead.createdAt)}</Td>
                <Td>
                  <Badge tone={TONES[lead.status]}>{label(lead.status)}</Badge>
                </Td>
                <Td>
                  <Select
                    value={lead.status}
                    disabled={updating === lead.id}
                    onChange={(event) => void updateStatus(lead.id, event.target.value as LeadStatus)}
                    aria-label={`Update status for ${lead.name}`}
                    className="w-36"
                  >
                    {Object.values(LeadStatus).map((status) => (
                      <option key={status} value={status}>
                        {label(status)}
                      </option>
                    ))}
                  </Select>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="text-sm text-slate-500">
          {filter === 'ALL' ? 'No leads have arrived yet.' : 'No leads match this status.'}
        </p>
      )}
    </div>
  );
}
