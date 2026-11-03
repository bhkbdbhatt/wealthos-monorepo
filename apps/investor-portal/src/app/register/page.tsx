'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Card, CardContent, ErrorBanner, Input, Label } from '@wealthos/ui-core';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [advisor, setAdvisor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({
        fullName,
        email,
        password,
        phone: phone.trim() || undefined,
        ownerAdvisorUsername: advisor.trim() || undefined,
      });
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not create your account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12">
      <Card className="w-full max-w-lg border-0">
        <CardContent className="p-8">
          <p className="text-lg font-semibold tracking-tight">
            Wealth<span className="text-emerald-700">OS</span>
          </p>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Create your investor account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Start tracking your portfolio and complete KYC in the app.
          </p>
          <form onSubmit={(event) => void onSubmit(event)} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div>
                <Label htmlFor="phone">Mobile (optional)</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  pattern="[6-9][0-9]{9}"
                  placeholder="9876543210"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-slate-500">
                At least 8 characters with one uppercase and one lowercase letter.
              </p>
            </div>
            <div>
              <Label htmlFor="advisor">Advisor username (optional)</Label>
              <Input
                id="advisor"
                value={advisor}
                onChange={(event) => setAdvisor(event.target.value)}
                placeholder="nirav-pathak"
              />
            </div>
            <ErrorBanner message={error} />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
          <p className="mt-5 text-sm text-slate-500">
            Already registered?{' '}
            <Link href="/login" className="font-medium text-emerald-700">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
