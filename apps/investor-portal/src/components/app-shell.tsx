'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { cn } from '@wealthos/ui-core';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/format';

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/sips', label: 'SIPs' },
  { href: '/goals', label: 'Goals' },
  { href: '/baskets', label: 'Baskets' },
  { href: '/cas', label: 'CAS import' },
  { href: '/kyc', label: 'KYC' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { session, ready, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && session === null) router.replace('/login');
  }, [ready, session, router]);

  if (!ready || session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading your portfolio...
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Wealth<span className="text-emerald-700">OS</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-800">{session.user.fullName}</p>
              <p className="text-xs text-slate-500">{session.user.email}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
              {initials(session.user.fullName)}
            </span>
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-2 text-sm font-medium',
                  active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
