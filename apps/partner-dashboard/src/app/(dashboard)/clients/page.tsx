'use client';

import Link from 'next/link';
import type { UserDto } from '@wealthos/shared-types';
import { Badge, ErrorBanner, PageHeader, Spinner, Table, Td, Th } from '@wealthos/ui-core';
import { formatDate, initials } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

export default function ClientsPage() {
  const { data, error, loading } = useApiData<UserDto[]>('/users/advisor-clients');

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Every investor currently mapped to your advisor practice."
      />
      <ErrorBanner message={error} />
      {loading ? (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Spinner /> Loading clients...
        </div>
      ) : data && data.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>Investor</Th>
              <Th>Status</Th>
              <Th>Joined</Th>
              <Th aria-label="Open" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((client) => (
              <tr key={client.id} className="hover:bg-slate-50">
                <Td>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                      {initials(client.fullName)}
                    </span>
                    <div>
                      <p className="font-medium text-slate-900">{client.fullName}</p>
                      <p className="text-xs text-slate-500">{client.email}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge tone={client.status === 'ACTIVE' ? 'success' : 'danger'}>{client.status}</Badge>
                </Td>
                <Td>{formatDate(client.createdAt)}</Td>
                <Td>
                  <Link href={`/clients/${client.id}`} className="text-sm font-medium text-emerald-700">
                    View portfolio
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="text-sm text-slate-500">No clients are mapped to this practice yet.</p>
      )}
    </div>
  );
}
