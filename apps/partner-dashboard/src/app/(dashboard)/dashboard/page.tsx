'use client';

import { AssetType, type AdvisorAnalyticsDto } from '@wealthos/shared-types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorBanner,
  LineChart,
  PageHeader,
  PieChart,
  Spinner,
  StatCard,
} from '@wealthos/ui-core';
import { formatCompactMoney, formatMoney } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

const ASSET_COLORS: Record<string, string> = {
  [AssetType.MUTUAL_FUND]: '#047857',
  [AssetType.EQUITY]: '#0ea5e9',
  [AssetType.BOND]: '#f59e0b',
  [AssetType.FIXED_DEPOSIT]: '#8b5cf6',
  [AssetType.INSURANCE]: '#ef4444',
};

function assetLabel(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function DashboardPage() {
  const { data, error, loading } = useApiData<AdvisorAnalyticsDto>('/analytics/advisor');

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Spinner /> Loading practice analytics...
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Practice dashboard"
        description="A live rollup of advised AUM, SIPs, commissions and portfolio mix."
      />
      <ErrorBanner message={error} />
      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Total AUM" value={formatCompactMoney(data.aumTotalPaise)} hint={formatMoney(data.aumTotalPaise)} />
            <StatCard label="Clients" value={data.clientCount} hint="Active advised relationships" />
            <StatCard label="Live SIPs" value={data.liveSipCount} hint={`${formatCompactMoney(data.mrrPaise)} monthly inflow`} />
            <StatCard
              label="Upfront commission"
              value={formatCompactMoney(data.commissionsUpfrontPaise)}
              tone="positive"
            />
            <StatCard
              label="Trail commission"
              value={formatCompactMoney(data.commissionsTrailPaise)}
              tone="positive"
            />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>AUM and SIP flow</CardTitle>
              </CardHeader>
              <CardContent>
                <LineChart
                  series={[
                    {
                      name: 'AUM',
                      color: '#047857',
                      points: data.timeseries.map((point) => ({ label: point.date, value: point.aumPaise })),
                    },
                    {
                      name: 'SIP inflow',
                      color: '#0ea5e9',
                      points: data.timeseries.map((point) => ({ label: point.date, value: point.sipInflowPaise })),
                    },
                  ]}
                  formatValue={(value) => formatCompactMoney(value)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Asset allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <PieChart
                  slices={data.byAssetClass.map((slice) => ({
                    label: assetLabel(slice.type),
                    value: slice.currentPaise,
                    color: ASSET_COLORS[slice.type] ?? '#94a3b8',
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
