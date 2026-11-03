'use client';

import { useState } from 'react';
import type { BasketDto, TransactionDto } from '@wealthos/shared-types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorBanner,
  Input,
  PageHeader,
  Spinner,
} from '@wealthos/ui-core';
import { ApiError, apiFetch, idempotencyKey } from '@/lib/api';
import { formatMoney, label, rupeesToPaise } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

export default function BasketsPage() {
  const { data, error, loading } = useApiData<BasketDto[]>('/baskets');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function buy(basket: BasketDto): Promise<void> {
    setBusy(basket.slug);
    setFormError(null);
    setNotice(null);
    try {
      const amountPaise = rupeesToPaise(amounts[basket.slug] ?? '');
      if (!Number.isInteger(amountPaise) || amountPaise < 100) {
        setFormError('Enter an amount of at least INR 1');
        return;
      }
      const result = await apiFetch<{ basketSlug: string; transactions: TransactionDto[] }>(
        `/baskets/${basket.slug}/buy`,
        {
          method: 'POST',
          body: JSON.stringify({ amountPaise, idempotencyKey: idempotencyKey() }),
        },
      );
      const invested = result.transactions.reduce((sum, txn) => sum + txn.amountPaise, 0);
      setNotice(`${basket.name} purchased across ${result.transactions.length} funds (${formatMoney(invested)}).`);
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : 'Could not buy this basket');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Wealth baskets"
        description="Buy a readymade multi-fund portfolio in a single order, split by target weight."
      />
      <ErrorBanner message={error ?? formError} />
      {notice ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Spinner /> Loading baskets...
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {(data ?? []).map((basket) => (
            <Card key={basket.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{basket.name}</CardTitle>
                    <p className="mt-1 text-sm text-slate-500">{basket.description}</p>
                  </div>
                  <Badge tone={basket.riskLevel === 'HIGH' ? 'danger' : basket.riskLevel === 'MODERATE' ? 'warning' : 'success'}>
                    {label(basket.riskLevel)} risk
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {basket.items.map((item) => (
                    <li key={item.asset.id} className="flex items-center justify-between gap-3">
                      <span className="text-slate-700">{item.asset.name}</span>
                      <span className="tabular-nums text-slate-500">{item.targetWeightPct}%</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    placeholder="Amount in INR"
                    value={amounts[basket.slug] ?? ''}
                    onChange={(event) =>
                      setAmounts((current) => ({ ...current, [basket.slug]: event.target.value }))
                    }
                    aria-label={`Amount for ${basket.name}`}
                  />
                  <Button onClick={() => void buy(basket)} disabled={busy === basket.slug}>
                    {busy === basket.slug ? 'Buying...' : 'Buy'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
