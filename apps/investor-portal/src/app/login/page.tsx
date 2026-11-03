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
  const [email, setEmail] = useState('asha.rao@client.dev');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && session !== null) router.replace('/');
  }, [ready, session, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#071713] px-6 py-12">
      <Card className="w-full max-w-md border-0">
        <CardContent className="p-8">
          <p className="text-lg font-semibold tracking-tight">
            Wealth<span className="text-emerald-700">OS</span>
          </p>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Your money, in one view</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track mutual funds, equities, goals, SIPs and KYC progress.
          </p>
          <form onSubmit={(event) => void onSubmit(event)} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
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
              {busy ? 'Signing in...' : 'Open my portfolio'}
            </Button>
          </form>
          <p className="mt-5 text-sm text-slate-500">
            New investor?{' '}
            <Link href="/register" className="font-medium text-emerald-700">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
