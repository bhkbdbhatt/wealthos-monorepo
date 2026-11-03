import type { ApiEnvelope } from '@wealthos/shared-types';

export const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';
export const SESSION_KEY = 'wealthos.partner.session';

export interface PartnerSession {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
  };
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

/**
 * Read the persisted session without touching window in server rendering.
 * @returns session or null
 */
export function readSession(): PartnerSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PartnerSession;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

/**
 * Persist or clear the local session.
 * @param session session payload or null to sign out
 */
export function writeSession(session: PartnerSession | null): void {
  if (typeof window === 'undefined') return;
  if (session === null) {
    window.localStorage.removeItem(SESSION_KEY);
  } else {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

function authHeader(): Record<string, string> {
  const token = readSession()?.tokens.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch a JSON API endpoint and unwrap failures into ApiError.
 * @param path path relative to /api/v1, starting with /
 * @param init fetch overrides
 * @returns parsed response body
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
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

/**
 * Download an authenticated CSV and trigger the browser save dialog.
 * @param path API path returning CSV
 * @param fallbackName filename when response has no Content-Disposition
 */
export async function downloadCsv(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, { headers: authHeader() });
  if (!response.ok) {
    throw new ApiError(response.status, 'DOWNLOAD_FAILED', 'Could not export this segment');
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = match?.[1] ?? fallbackName;
  anchor.click();
  URL.revokeObjectURL(url);
}
