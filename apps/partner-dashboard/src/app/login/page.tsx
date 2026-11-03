'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, CardContent, ErrorBanner, Input, Label } from '@wealthos/ui-core';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { session, ready, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('nirav@wealthos.dev');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && session !== null) router.replace('/dashboard');
  }, [ready, session, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[#071713] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 top-20 h-80 w-80 rounded-full border border-emerald-400/20" />
        <div className="absolute -right-8 top-36 h-52 w-52 rounded-full border border-emerald-400/20" />
        <p className="text-lg font-semibold">
          Wealth<span className="text-emerald-400">OS</span>
        </p>
        <div>
          <h1 className="relative max-w-lg text-5xl font-semibold leading-[1.05] tracking-tight">
            One desk for AUM, clients and commissions.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
            Track every advised portfolio, build dynamic client segments and turn your practice
            into a white-label acquisition engine.
          </p>
        </div>
        <p className="text-xs text-slate-500">Advisor workspace / API v1</p>
      </section>
      <section className="flex items-center justify-center bg-white px-6 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <p className="text-sm font-medium text-emerald-700">Partner sign in</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use your advisor or admin account to open the partner desk.
            </p>
            <form onSubmit={(event) => void onSubmit(event)} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <ErrorBanner message={error} />
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Signing in...' : 'Open partner desk'}
              </Button>
            </form>
            <p className="mt-5 text-xs text-slate-500">
              Investor?{' '}
              <Link href="http://localhost:3001/login" className="font-medium text-emerald-700">
                Open the investor portal
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
