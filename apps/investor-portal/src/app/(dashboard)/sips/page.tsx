'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { SipStatus, type AssetDto, type SipDto } from '@wealthos/shared-types';
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
import { ApiError, apiFetch } from '@/lib/api';
import { formatDate, formatMoney, label, rupeesToPaise } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

const STATUS_TONES: Record<SipStatus, BadgeTone> = {
  [SipStatus.ACTIVE]: 'success',
  [SipStatus.PAUSED]: 'warning',
  [SipStatus.CANCELLED]: 'danger',
  [SipStatus.COMPLETED]: 'info',
};

export default function SipsPage() {
  const { data, error, loading, reload } = useApiData<SipDto[]>('/sips');
  const { data: assets } = useApiData<AssetDto[]>('/assets');
  const [assetSlug, setAssetSlug] = useState('');
  const [amount, setAmount] = useState('10000');
  const [intervals, setIntervals] = useState('1');
  const [days, setDays] = useState('5');
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (assetSlug === '' && assets && assets.length > 0) setAssetSlug(assets[0]!.slug);
  }, [assets, assetSlug]);

  function chooseIntervals(value: string): void {
    setIntervals(value);
    if (value === '1') setDays('5');
    else if (value === '2') setDays('5, 20');
    else setDays('5, 15, 25');
  }

  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    setNotice(null);
    try {
      const monthlyAmountPaise = rupeesToPaise(amount);
      const preferredDays = days
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 31);
      await apiFetch<SipDto>('/sips', {
        method: 'POST',
        body: JSON.stringify({
          assetSlug,
          monthlyAmountPaise,
          intervalsPerMonth: Number(intervals),
          preferredDays,
        }),
      });
      setNotice('SIP created and the next four debit dates have been scheduled.');
      reload();
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : 'Could not create this SIP');
    } finally {
      setBusy(false);
    }
  }

  async function action(id: string, kind: 'pause' | 'resume' | 'cancel'): Promise<void> {
    setActionBusy(id);
    setFormError(null);
    try {
      if (kind === 'cancel') {
        await apiFetch<SipDto>(`/sips/${id}`, { method: 'DELETE' });
      } else {
        await apiFetch<SipDto>(`/sips/${id}/${kind}`, { method: 'PATCH' });
      }
      reload();
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : 'Could not update this SIP');
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Systematic plans"
        description="Split a monthly mandate into one, two or three debits and manage the schedule."
      />
      <ErrorBanner message={error ?? formError} />
      {notice ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>New SIP</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void create(event)} className="space-y-4">
              <div>
                <Label htmlFor="sip-asset">Asset</Label>
                <Select id="sip-asset" value={assetSlug} onChange={(event) => setAssetSlug(event.target.value)} required>
                  {(assets ?? []).map((asset) => (
                    <option key={asset.id} value={asset.slug}>
                      {asset.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="sip-amount">Monthly amount in INR</Label>
                <Input id="sip-amount" type="number" min={100} step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="sip-intervals">Debits per month</Label>
                  <Select id="sip-intervals" value={intervals} onChange={(event) => chooseIntervals(event.target.value)}>
                    <option value="1">1x monthly</option>
                    <option value="2">2x monthly</option>
                    <option value="3">3x monthly</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sip-days">Preferred days</Label>
                  <Input id="sip-days" value={days} onChange={(event) => setDays(event.target.value)} placeholder="5, 15, 25" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={busy || assetSlug === ''}>
                {busy ? 'Creating...' : 'Start SIP'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Your SIPs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center gap-3 p-5 text-sm text-slate-500">
                <Spinner /> Loading SIPs...
              </div>
            ) : data && data.length > 0 ? (
              <Table className="border-0 shadow-none">
                <thead>
                  <tr>
                    <Th>Asset</Th>
                    <Th>Monthly</Th>
                    <Th>Debits</Th>
                    <Th>Next run</Th>
                    <Th>Status</Th>
                    <Th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((sip) => (
                    <tr key={sip.id}>
                      <Td>{sip.asset.name}</Td>
                      <Td className="tabular-nums">{formatMoney(sip.monthlyAmountPaise)}</Td>
                      <Td>{sip.intervalsPerMonth}x / days {sip.scheduledDays.join(', ')}</Td>
                      <Td>{formatDate(sip.nextRunOn)}</Td>
                      <Td>
                        <Badge tone={STATUS_TONES[sip.status]}>{label(sip.status)}</Badge>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          {sip.status === SipStatus.ACTIVE ? (
                            <button
                              type="button"
                              disabled={actionBusy === sip.id}
                              onClick={() => void action(sip.id, 'pause')}
                              className="text-xs font-medium text-amber-700"
                            >
                              Pause
                            </button>
                          ) : null}
                          {sip.status === SipStatus.PAUSED ? (
                            <button
                              type="button"
                              disabled={actionBusy === sip.id}
                              onClick={() => void action(sip.id, 'resume')}
                              className="text-xs font-medium text-emerald-700"
                            >
                              Resume
                            </button>
                          ) : null}
                          {sip.status !== SipStatus.CANCELLED && sip.status !== SipStatus.COMPLETED ? (
                            <button
                              type="button"
                              disabled={actionBusy === sip.id}
                              onClick={() => void action(sip.id, 'cancel')}
                              className="text-xs font-medium text-red-600"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="p-5 text-sm text-slate-500">No SIPs yet. Create one to automate investments.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
