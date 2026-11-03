'use client';

import { useState } from 'react';
import { ALL_KYC_STATES, KycState } from '@wealthos/shared-types';
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
  Spinner,
} from '@wealthos/ui-core';
import { cn } from '@wealthos/ui-core';
import { ApiError, apiFetch } from '@/lib/api';
import { formatDate, label } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

interface KycStateResponse {
  userId: string;
  state: KycState;
  panMasked: string | null;
  rejectionReason: string | null;
  updatedAt: string;
}

interface KycTimelineEntry {
  kind: string;
  fromState: string | null;
  toState: string | null;
  at: string;
}

export default function KycPage() {
  const state = useApiData<KycStateResponse>('/kyc/me/state');
  const timeline = useApiData<KycTimelineEntry[]>('/kyc/me/timeline');
  const [pan, setPan] = useState('');
  const [maskedAadhaar, setMaskedAadhaar] = useState('XXXXXXXX1234');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(path: string, method: 'PUT' | 'POST', body?: unknown): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch<KycStateResponse>(path, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      setPan('');
      state.reload();
      timeline.reload();
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : 'Could not complete this KYC step');
    } finally {
      setBusy(false);
    }
  }

  const current = state.data?.state ?? KycState.INITIATED;
  const currentIndex = ALL_KYC_STATES.indexOf(current);

  return (
    <div>
      <PageHeader
        title="KYC and onboarding"
        description="Complete the digital KYC pipeline once. Each step unlocks the next."
        actions={state.data ? <Badge tone={current === KycState.COMPLETED ? 'success' : 'info'}>{label(current)}</Badge> : null}
      />
      <ErrorBanner message={state.error ?? timeline.error ?? actionError} />
      {state.loading ? (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Spinner /> Loading KYC status...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <ol className="space-y-2">
                {ALL_KYC_STATES.map((step, index) => {
                  const done = currentIndex >= index;
                  const active = currentIndex === index;
                  return (
                    <li
                      key={step}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
                        active && 'border-emerald-300 bg-emerald-50',
                        done && !active && 'border-slate-200 bg-white',
                        !done && 'border-slate-200 bg-slate-50 text-slate-500',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                          done ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600',
                        )}
                      >
                        {index + 1}
                      </span>
                      {label(step)}
                    </li>
                  );
                })}
              </ol>
              {state.data?.rejectionReason ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {state.data.rejectionReason}
                </div>
              ) : null}
              {current === KycState.INITIATED ? (
                <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <div>
                    <Label htmlFor="pan">PAN</Label>
                    <Input
                      id="pan"
                      value={pan}
                      onChange={(event) => setPan(event.target.value.toUpperCase())}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                    />
                  </div>
                  <Button
                    disabled={busy || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)}
                    onClick={() => void run('/kyc/me/pan', 'PUT', { pan })}
                  >
                    Validate PAN
                  </Button>
                </div>
              ) : null}
              {current === KycState.PAN_VALIDATED ? (
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm text-slate-600">PAN {state.data?.panMasked ?? ''} is verified. Sync your DigiLocker documents next.</p>
                  <Button className="mt-3" disabled={busy} onClick={() => void run('/kyc/me/digilocker', 'POST')}>
                    Sync DigiLocker
                  </Button>
                </div>
              ) : null}
              {current === KycState.DIGILOCKER_SYNCED ? (
                <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <div>
                    <Label htmlFor="aadhaar">Masked Aadhaar</Label>
                    <Input
                      id="aadhaar"
                      value={maskedAadhaar}
                      onChange={(event) => setMaskedAadhaar(event.target.value.toUpperCase())}
                      maxLength={12}
                    />
                    <p className="mt-1 text-xs text-slate-500">Send only the last four digits, e.g. XXXXXXXX1234.</p>
                  </div>
                  <Button
                    disabled={busy || !/^[X*]{8}[0-9]{4}$/.test(maskedAadhaar)}
                    onClick={() => void run('/kyc/me/aadhaar-esign', 'POST', { maskedAadhaar })}
                  >
                    Sign with Aadhaar
                  </Button>
                </div>
              ) : null}
              {current === KycState.AADHAAR_ESIGNED ? (
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm text-slate-600">e-Sign complete. Schedule your short video KYC call.</p>
                  <Button className="mt-3" disabled={busy} onClick={() => void run('/kyc/me/video-kyc/schedule', 'POST')}>
                    Schedule video KYC
                  </Button>
                </div>
              ) : null}
              {current === KycState.VIDEO_KYC_PENDING ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Video KYC is scheduled. The status updates automatically after the call.
                </div>
              ) : null}
              {current === KycState.COMPLETED ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  KYC complete. You can now use every investment feature.
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Audit timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {timeline.loading ? (
                <div className="flex items-center gap-3 p-5 text-sm text-slate-500">
                  <Spinner /> Loading timeline...
                </div>
              ) : timeline.data && timeline.data.length > 0 ? (
                <ol className="divide-y divide-slate-100">
                  {timeline.data.map((entry, index) => (
                    <li key={`${entry.at}-${index}`} className="px-5 py-4 text-sm">
                      <p className="font-medium text-slate-800">
                        {entry.fromState === null ? 'Started' : `${label(entry.fromState)} to ${label(entry.toState ?? '')}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(entry.at)} / {label(entry.kind)}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="p-5 text-sm text-slate-500">No KYC events yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
