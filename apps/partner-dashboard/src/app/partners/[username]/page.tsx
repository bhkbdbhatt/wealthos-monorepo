'use client';

import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { PartnerDto } from '@wealthos/shared-types';
import {
  Button,
  Card,
  CardContent,
  ErrorBanner,
  Input,
  Label,
  Spinner,
  Textarea,
} from '@wealthos/ui-core';
import { ApiError, apiFetch } from '@/lib/api';
import { useApiData } from '@/lib/use-api-data';

export default function PublicPartnerPage() {
  const params = useParams<{ username: string }>();
  const { data, error, errorStatus, loading } = useApiData<PartnerDto>(
    `/partners/public/${encodeURIComponent(params.username)}`,
  );
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [received, setReceived] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await apiFetch<{ received: true }>(
        `/partners/public/${encodeURIComponent(params.username)}/leads`,
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            phone,
            email: email.trim() || undefined,
            message: message.trim() || undefined,
          }),
        },
      );
      setReceived(true);
      setName('');
      setPhone('');
      setEmail('');
      setMessage('');
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : 'Could not send your enquiry');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-3 text-sm text-slate-500">
        <Spinner /> Loading advisor page...
      </main>
    );
  }

  if (errorStatus === 404 || !data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-semibold text-emerald-700">WealthOS partner page</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">This page is not live</h1>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          The advisor may have changed their username or unpublished the page.
        </p>
        <ErrorBanner message={error && errorStatus !== 404 ? error : null} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
            {data.orgName}
          </p>
          <div className="mt-8 flex items-center gap-5">
            {data.photoUrl ? (
              <img
                src={data.photoUrl}
                alt={data.orgName}
                className="h-24 w-24 rounded-full border border-white/20 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-3xl font-semibold">
                {data.orgName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{data.orgName}</h1>
              <p className="mt-1 text-emerald-300">{data.tagline ?? 'Goal-first wealth advisory'}</p>
              <p className="mt-1 text-sm text-slate-400">
                {data.yearsExperience > 0 ? `${data.yearsExperience}+ years advising investors` : 'Independent advisor'}
              </p>
            </div>
          </div>
          <p className="mt-8 max-w-xl text-base leading-7 text-slate-300">
            {data.bio ?? 'Reach out for a goal-mapping conversation and a portfolio review.'}
          </p>
          {data.specialties.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {data.specialties.map((specialty) => (
                <span key={specialty} className="rounded-full border border-white/15 px-3 py-1 text-sm text-slate-200">
                  {specialty}
                </span>
              ))}
            </div>
          ) : null}
          {data.website ? (
            <a
              href={data.website}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-block text-sm font-medium text-emerald-400"
            >
              Visit website
            </a>
          ) : null}
        </section>
        <Card className="border-white/10 bg-white text-slate-900">
          <CardContent className="p-7">
            <h2 className="text-xl font-semibold tracking-tight">Book a conversation</h2>
            <p className="mt-1 text-sm text-slate-500">
              Share your details and the advisor will get back to you.
            </p>
            {received ? (
              <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                Thank you. Your enquiry has reached {data.orgName}.
              </div>
            ) : (
              <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="lead-name">Your name</Label>
                  <Input id="lead-name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
                </div>
                <div>
                  <Label htmlFor="lead-phone">Mobile number</Label>
                  <Input
                    id="lead-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="10-digit Indian mobile"
                    pattern="[6-9][0-9]{9}"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lead-email">Email (optional)</Label>
                  <Input id="lead-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="lead-message">What would you like help with?</Label>
                  <Textarea
                    id="lead-message"
                    rows={4}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    maxLength={1000}
                  />
                </div>
                <ErrorBanner message={formError} />
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? 'Sending...' : 'Request a callback'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
