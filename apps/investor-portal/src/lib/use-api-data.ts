'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from './api';
import { readSession } from './api';
import { investorDemoData } from './demo-data';

export interface ApiData<T> {
  data: T | null;
  error: string | null;
  errorStatus: number | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Small client-side fetch hook for read-only views.
 * @param path API path or null to pause loading
 * @returns data, error, loading and a reload trigger
 */
export function useApiData<T>(path: string | null): ApiData<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    const demo = readSession()?.tokens.accessToken === 'demo-investor-token' ? investorDemoData(path) : null;
    if (demo !== null) {
      setData(demo as T);
      setLoading(false);
      return;
    }
    apiFetch<T>(path)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof ApiError ? cause.message : 'Could not load this data');
        setErrorStatus(cause instanceof ApiError ? cause.status : 500);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  return { data, error, errorStatus, loading, reload };
}
