'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AssetType, type PortfolioSummary } from '@wealthos/shared-types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorBanner,
  PageHeader,
  PieChart,
  Spinner,
  StatCard,
  Table,
  Td,
  Th,
} from '@wealthos/ui-core';
import { formatDate, formatMoney, formatPct } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

const ASSET_COLORS: Record<string, string> = {
  [AssetType.MUTUAL_FUND]: '#047857',
  [AssetType.EQUITY]: '#0ea5e9',
  [AssetType.BOND]: '#f59e0b',
  [AssetType.FIXED_DEPOSIT]: '#8b5cf6',
  [AssetType.INSURANCE]: '#ef4444',
};

export default function ClientPortfolioPage() {
  const params = useParams<{ id: string }>();
  const { data, error, loading } = useApiData<PortfolioSummary>(
    `/portfolios?userId=${encodeURIComponent(params.id)}`,
  );

  return (
    <div>
      <PageHeader
        title="Client portfolio"
        description="Unified holdings, allocation and annualized performance."
        actions={
          <Link href="/clients" className="text-sm font-medium text-emerald-700">
            Back to clients
          </Link>
        }
      />
      <ErrorBanner message={error} />
      {loading ? (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Spinner /> Loading portfolio...
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Current value" value={formatMoney(data.currentPaise)} />
            <StatCard label="Invested" value={formatMoney(data.investedPaise)} />
            <StatCard
              label="Gain / loss"
              value={formatMoney(data.gainPaise)}
              tone={data.gainPaise >= 0 ? 'positive' : 'negative'}
              hint={formatPct(data.gainPct)}
            />
            <StatCard label="XIRR" value={formatPct(data.xirrPct)} hint="Annualized, irregular cashflows" />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Holdings</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.holdings.length > 0 ? (
                  <Table className="border-0 shadow-none">
                    <thead>
                      <tr>
                        <Th>Asset</Th>
                        <Th>Units</Th>
                        <Th>Invested</Th>
                        <Th>Current</Th>
                        <Th>Gain</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.holdings.map((holding) => (
                        <tr key={holding.holdingId}>
                          <Td>
                            <p className="font-medium text-slate-900">{holding.asset.name}</p>
                            <p className="text-xs text-slate-500">
                              {holding.asset.type} / since {formatDate(holding.firstPurchaseAt)}
                            </p>
                          </Td>
                          <Td className="tabular-nums">{Number(holding.units).toFixed(3)}</Td>
                          <Td className="tabular-nums">{formatMoney(holding.investedPaise)}</Td>
                          <Td className="tabular-nums">{formatMoney(holding.currentPaise)}</Td>
                          <Td
                            className={
                              holding.gainPaise >= 0
                                ? 'tabular-nums font-medium text-emerald-700'
                                : 'tabular-nums font-medium text-red-600'
                            }
                          >
                            {formatMoney(holding.gainPaise)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <p className="p-5 text-sm text-slate-500">This client has no current holdings.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <PieChart
                  slices={data.allocationByType.map((slice) => ({
                    label: slice.type.replaceAll('_', ' '),
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
