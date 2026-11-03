'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { AssetType, NavPoint } from '@wealthos/shared-types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorBanner,
  LineChart,
  PageHeader,
  Spinner,
  StatCard,
} from '@wealthos/ui-core';
import { formatDate, formatMoney } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

interface AssetDetail {
  id: string;
  slug: string;
  name: string;
  type: AssetType;
  schemeCode: string;
  issuer: string;
  category: string | null;
  navPaise: number;
  navUpdatedAt: string;
  navHistory: NavPoint[];
}

export default function AssetDetailPage() {
  const params = useParams<{ slug: string }>();
  const { data, error, loading } = useApiData<AssetDetail>(
    `/assets/${encodeURIComponent(params.slug)}`,
  );

  return (
    <div>
      <PageHeader
        title={data?.name ?? 'Asset detail'}
        description={data ? `${data.issuer}${data.category ? ` / ${data.category}` : ''}` : undefined}
        actions={
          <Link href="/" className="text-sm font-medium text-emerald-700">
            Back to portfolio
          </Link>
        }
      />
      <ErrorBanner message={error} />
      {loading ? (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Spinner /> Loading NAV history...
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Latest NAV" value={formatMoney(data.navPaise)} hint={`Updated ${formatDate(data.navUpdatedAt)}`} />
            <StatCard label="Scheme code" value={data.schemeCode} />
            <StatCard label="Asset class" value={data.type.replaceAll('_', ' ')} />
          </div>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>NAV history</CardTitle>
            </CardHeader>
            <CardContent>
              {data.navHistory.length > 1 ? (
                <LineChart
                  series={[
                    {
                      name: 'NAV',
                      color: '#047857',
                      points: data.navHistory.map((point) => ({ label: point.date, value: point.navPaise })),
                    },
                  ]}
                  formatValue={(value) => formatMoney(value)}
                />
              ) : (
                <p className="text-sm text-slate-500">Not enough NAV history has been recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
