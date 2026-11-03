'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { cn } from '@wealthos/ui-core';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/format';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', mark: '01' },
  { href: '/clients', label: 'Clients', mark: '02' },
  { href: '/segments', label: 'Segments', mark: '03' },
  { href: '/commissions', label: 'Commissions', mark: '04' },
  { href: '/leads', label: 'Leads', mark: '05' },
  { href: '/profile', label: 'White-label', mark: '06' },
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
        Loading partner desk...
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="border-b border-slate-200 bg-white lg:flex lg:min-h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-6 py-6 lg:block">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-slate-900">
            Wealth<span className="text-emerald-700">OS</span>
          </Link>
          <p className="mt-1 hidden text-xs uppercase tracking-widest text-slate-400 lg:block">
            Partner desk
          </p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                  active
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <span className="text-[10px] tabular-nums text-slate-400">{item.mark}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-slate-100 p-4 lg:mt-auto lg:block">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
              {initials(session.user.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{session.user.fullName}</p>
              <p className="truncate text-xs text-slate-500">{session.user.role}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace('/login');
            }}
            className="mt-3 text-xs font-medium text-slate-500 hover:text-red-600"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 lg:hidden">
          <span className="text-sm font-medium text-slate-700">{session.user.fullName}</span>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace('/login');
            }}
            className="text-xs font-medium text-slate-500"
          >
            Sign out
          </button>
        </header>
        <main className="mx-auto max-w-[1480px] px-5 py-6 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
