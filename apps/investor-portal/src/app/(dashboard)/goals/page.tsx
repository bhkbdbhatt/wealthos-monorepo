'use client';

import { useState, type FormEvent } from 'react';
import type { GoalDto } from '@wealthos/shared-types';
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
  Progress,
  Spinner,
} from '@wealthos/ui-core';
import { ApiError, apiFetch } from '@/lib/api';
import { formatMoney, formatPct, rupeesToPaise } from '@/lib/format';
import { useApiData } from '@/lib/use-api-data';

export default function GoalsPage() {
  const { data, error, loading, reload } = useApiData<GoalDto[]>('/goals');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('1000000');
  const [horizon, setHorizon] = useState('60');
  const [expectedReturn, setExpectedReturn] = useState('12');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await apiFetch<GoalDto>('/goals', {
        method: 'POST',
        body: JSON.stringify({
          name,
          targetAmountPaise: rupeesToPaise(target),
          horizonMonths: Number(horizon),
          expectedAnnualReturnBps: Math.round(Number(expectedReturn) * 100),
        }),
      });
      setName('');
      reload();
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : 'Could not create this goal');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string): Promise<void> {
    setRemoving(id);
    setFormError(null);
    try {
      await apiFetch<{ deleted: true }>(`/goals/${id}`, { method: 'DELETE' });
      reload();
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : 'Could not remove this goal');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Goal mapper"
        description="Turn a target and timeline into a recommended monthly investment."
      />
      <ErrorBanner message={error ?? formError} />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create a goal</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void create(event)} className="space-y-4">
              <div>
                <Label htmlFor="goal-name">Goal name</Label>
                <Input id="goal-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Child education" required minLength={2} />
              </div>
              <div>
                <Label htmlFor="goal-target">Target amount in INR</Label>
                <Input id="goal-target" type="number" min={100} value={target} onChange={(event) => setTarget(event.target.value)} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="goal-horizon">Horizon (months)</Label>
                  <Input id="goal-horizon" type="number" min={1} max={720} value={horizon} onChange={(event) => setHorizon(event.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="goal-return">Expected return %</Label>
                  <Input id="goal-return" type="number" min={0} max={50} step="0.5" value={expectedReturn} onChange={(event) => setExpectedReturn(event.target.value)} required />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={busy || name.trim().length < 2}>
                {busy ? 'Calculating...' : 'Map my goal'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <Spinner /> Loading goals...
            </div>
          ) : data && data.length > 0 ? (
            data.map((goal) => (
              <Card key={goal.id}>
                <CardContent>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{goal.name}</h3>
                      <p className="text-sm text-slate-500">
                        {formatMoney(goal.currentValuePaise)} of {formatMoney(goal.targetAmountPaise)} in {goal.horizonMonths} months
                      </p>
                    </div>
                    <Badge tone={goal.achieved ? 'success' : 'info'}>{goal.achieved ? 'Achieved' : formatPct(goal.progressPct)}</Badge>
                  </div>
                  <div className="mt-4">
                    <Progress value={goal.progressPct} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Recommended monthly</p>
                      <p className="text-lg font-semibold text-emerald-700">{formatMoney(goal.recommendedMonthlyPaise)}</p>
                      <p className="text-xs text-slate-500">Assumes {formatPct(goal.expectedAnnualReturnBps / 100)} annual return</p>
                    </div>
                    <button
                      type="button"
                      disabled={removing === goal.id}
                      onClick={() => void remove(goal.id)}
                      className="text-xs font-medium text-red-600"
                    >
                      Delete goal
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-sm text-slate-500">No goals yet. Create one to see your monthly path.</p>
          )}
        </div>
      </div>
    </div>
  );
}
