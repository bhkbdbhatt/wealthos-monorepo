import type { ApiEnvelope } from '@wealthos/shared-types';

export const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';
export const SESSION_KEY = 'wealthos.investor.session';

export interface InvestorSession {
  user: { id: string; email: string; fullName: string; role: string };
  tokens: { accessToken: string; refreshToken: string; expiresInSeconds: number };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function readSession(): InvestorSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as InvestorSession;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function writeSession(session: InvestorSession | null): void {
  if (typeof window === 'undefined') return;
  if (session === null) window.localStorage.removeItem(SESSION_KEY);
  else window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function authHeader(): Record<string, string> {
  const token = readSession()?.tokens.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  for (const [key, value] of Object.entries(authHeader())) headers.set(key, value);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: 'no-store' });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const envelope = payload as ApiEnvelope<unknown> | null;
    throw new ApiError(
      response.status,
      envelope?.error?.code ?? 'HTTP_ERROR',
      envelope?.error?.message ?? `Request failed with ${response.status}`,
    );
  }
  return payload as T;
}

export function idempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
