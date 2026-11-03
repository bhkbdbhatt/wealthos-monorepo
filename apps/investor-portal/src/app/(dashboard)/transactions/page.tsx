'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  TransactionType,
  type AssetDto,
  type PaginatedTransactions,
  type TransactionDto,
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
  type BadgeTone,
} from '@wealthos/ui-core';
import { ApiError, apiFetch, idempotencyKey } from '@/lib/api';
import { formatDate, formatMoney, label, rupeesToPaise } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

const STATUS_TONES: Record<string, BadgeTone> = {
  EXECUTED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
};

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApiData<PaginatedTransactions>(
    `/transactions?page=${page}&pageSize=20`,
  );
  const { data: assets } = useApiData<AssetDto[]>('/assets');
  const [assetSlug, setAssetSlug] = useState('');
  const [type, setType] = useState<TransactionType.BUY | TransactionType.SELL>(TransactionType.BUY);
  const [amount, setAmount] = useState('5000');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (assetSlug === '' && assets && assets.length > 0) setAssetSlug(assets[0]!.slug);
  }, [assets, assetSlug]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setNotice(null);
    try {
      const amountPaise = rupeesToPaise(amount);
      if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
        setFormError('Enter a valid rupee amount');
        return;
      }
      const result = await apiFetch<TransactionDto>('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          assetSlug,
          type,
          amountPaise,
          idempotencyKey: idempotencyKey(),
        }),
      });
      setNotice(
        `${label(result.type)} executed for ${formatMoney(result.amountPaise)} at NAV ${formatMoney(result.navPaise)}.`,
      );
      reload();
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : 'Could not execute this transaction');
    } finally {
      setBusy(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <PageHeader title="Transactions" description="Execute a buy or redemption and review your order history." />
      <ErrorBanner message={error ?? formError} />
      {notice ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>New transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void submit(event)} className="space-y-4">
              <div>
                <Label htmlFor="asset">Asset</Label>
                <Select id="asset" value={assetSlug} onChange={(event) => setAssetSlug(event.target.value)} required>
                  {(assets ?? []).map((asset) => (
                    <option key={asset.id} value={asset.slug}>
                      {asset.name} ({asset.type})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="type">Action</Label>
                <Select
                  id="type"
                  value={type}
                  onChange={(event) => setType(event.target.value as TransactionType.BUY | TransactionType.SELL)}
                >
                  <option value={TransactionType.BUY}>Buy / invest</option>
                  <option value={TransactionType.SELL}>Sell / redeem</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="amount">Amount in INR</Label>
                <Input
                  id="amount"
                  type="number"
                  min={1}
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
                <p className="mt-1 text-xs text-slate-500">
                  For a redemption, units are reduced proportionally to this value.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={busy || assetSlug === ''}>
                {busy ? 'Executing...' : 'Execute transaction'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Order history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center gap-3 p-5 text-sm text-slate-500">
                <Spinner /> Loading transactions...
              </div>
            ) : data && data.items.length > 0 ? (
              <>
                <Table className="border-0 shadow-none">
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Asset</Th>
                      <Th>Type</Th>
                      <Th>Units</Th>
                      <Th>Amount</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((transaction) => (
                      <tr key={transaction.id}>
                        <Td>{formatDate(transaction.executedAt ?? transaction.createdAt)}</Td>
                        <Td>{transaction.asset.name}</Td>
                        <Td>{label(transaction.type)}</Td>
                        <Td className="tabular-nums">{Number(transaction.units).toFixed(3)}</Td>
                        <Td className="tabular-nums">{formatMoney(transaction.amountPaise)}</Td>
                        <Td>
                          <Badge tone={STATUS_TONES[transaction.status] ?? 'neutral'}>{label(transaction.status)}</Badge>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
                  <span className="text-slate-500">
                    Page {page} of {totalPages} / {data.total} orders
                  </span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className="p-5 text-sm text-slate-500">No transactions yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
