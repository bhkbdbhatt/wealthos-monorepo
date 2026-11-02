export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface ApiEnvelope<T> {
  ok: boolean;
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Json;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** ISO date string, e.g. "2026-05-01" */
export type IsoDate = string;

/** ISO timestamp string, e.g. "2026-05-01T06:00:00.000Z" */
export type IsoTimestamp = string;
