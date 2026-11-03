'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PartnerDto } from '@wealthos/shared-types';
import {
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
  Textarea,
} from '@wealthos/ui-core';
import { ApiError, apiFetch } from '@/lib/api';
import { useApiData } from '@/lib/use-api-data';

interface ProfileForm {
  username: string;
  orgName: string;
  tagline: string;
  bio: string;
  photoUrl: string;
  phone: string;
  website: string;
  specialties: string;
  yearsExperience: string;
  active: boolean;
}

const EMPTY_FORM: ProfileForm = {
  username: '',
  orgName: '',
  tagline: '',
  bio: '',
  photoUrl: '',
  phone: '',
  website: '',
  specialties: '',
  yearsExperience: '0',
  active: true,
};

export default function ProfilePage() {
  const { data, error, errorStatus, loading, reload } = useApiData<PartnerDto>('/partners/me');
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!data) return;
    setForm({
      username: data.username,
      orgName: data.orgName,
      tagline: data.tagline ?? '',
      bio: data.bio ?? '',
      photoUrl: data.photoUrl ?? '',
      phone: data.phone ?? '',
      website: data.website ?? '',
      specialties: data.specialties.join(', '),
      yearsExperience: String(data.yearsExperience),
      active: data.active,
    });
  }, [data]);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(): Promise<void> {
    setBusy(true);
    setNotice(null);
    setFormError(null);
    try {
      const updated = await apiFetch<PartnerDto>('/partners/me', {
        method: 'PUT',
        body: JSON.stringify({
          username: form.username.trim(),
          orgName: form.orgName.trim(),
          tagline: form.tagline.trim() || undefined,
          bio: form.bio.trim() || undefined,
          photoUrl: form.photoUrl.trim() || undefined,
          phone: form.phone.trim() || undefined,
          website: form.website.trim() || undefined,
          specialties: form.specialties
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          yearsExperience: Number(form.yearsExperience) || 0,
          active: form.active,
        }),
      });
      setNotice(`Saved. Your public page is ${origin}/partners/${updated.username}`);
      reload();
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : 'Could not save this profile');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="White-label page"
        description="Publish an advisor landing page that captures leads straight into your inbox."
        actions={
          data ? (
            <Link href={`/partners/${data.username}`} className="text-sm font-medium text-emerald-700">
              Open public page
            </Link>
          ) : null
        }
      />
      <ErrorBanner message={formError ?? (errorStatus === 404 ? null : error)} />
      {notice ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Spinner /> Loading profile...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{data ? 'Edit profile' : 'Create your partner profile'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="username">Public username</Label>
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(event) => update('username', event.target.value.toLowerCase())}
                    placeholder="nirav-pathak"
                    pattern="[a-z0-9-]+"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="orgName">Practice / firm name</Label>
                  <Input
                    id="orgName"
                    value={form.orgName}
                    onChange={(event) => update('orgName', event.target.value)}
                    placeholder="Pathak Wealth Advisors"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={form.tagline}
                  onChange={(event) => update('tagline', event.target.value)}
                  placeholder="Goal-first investing for busy families"
                />
              </div>
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  rows={5}
                  value={form.bio}
                  onChange={(event) => update('bio', event.target.value)}
                  placeholder="Tell prospective clients how you work and who you help."
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="photoUrl">Photo URL</Label>
                  <Input
                    id="photoUrl"
                    value={form.photoUrl}
                    onChange={(event) => update('photoUrl', event.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={form.website}
                    onChange={(event) => update('website', event.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Contact phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(event) => update('phone', event.target.value)}
                    placeholder="9876543210"
                  />
                </div>
                <div>
                  <Label htmlFor="years">Years of experience</Label>
                  <Input
                    id="years"
                    type="number"
                    min={0}
                    max={70}
                    value={form.yearsExperience}
                    onChange={(event) => update('yearsExperience', event.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="specialties">Specialties</Label>
                <Input
                  id="specialties"
                  value={form.specialties}
                  onChange={(event) => update('specialties', event.target.value)}
                  placeholder="Retirement, Tax planning, SIPs"
                />
                <p className="mt-1 text-xs text-slate-500">Comma-separated, up to 12.</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => update('active', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-700"
                />
                Publish this page publicly
              </label>
              <Button onClick={() => void save()} disabled={busy || form.username.trim().length < 3 || form.orgName.trim().length < 2}>
                {busy ? 'Saving...' : 'Save profile'}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Public preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl bg-slate-900 p-6 text-white">
                {form.photoUrl ? (
                  <img src={form.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-xl font-semibold">
                    {form.orgName.charAt(0) || 'W'}
                  </div>
                )}
                <h3 className="mt-4 text-xl font-semibold">{form.orgName || 'Your practice name'}</h3>
                <p className="mt-1 text-sm text-emerald-300">{form.tagline || 'Your tagline appears here'}</p>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  {form.bio || 'Your advisor bio will help prospective clients decide to reach out.'}
                </p>
                {form.specialties ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {form.specialties.split(',').map((specialty) => (
                      <span key={specialty} className="rounded-full bg-white/10 px-2 py-1 text-xs">
                        {specialty.trim()}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="mt-4 break-all text-xs text-slate-500">
                {origin}/partners/{form.username || 'your-username'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
