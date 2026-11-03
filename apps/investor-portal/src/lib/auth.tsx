'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  apiFetch,
  readSession,
  writeSession,
  type InvestorSession,
} from './api';

interface SessionResponse {
  user: InvestorSession['user'];
  tokens: InvestorSession['tokens'];
}

interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  ownerAdvisorUsername?: string;
}

interface AuthContextValue {
  session: InvestorSession | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<InvestorSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(readSession());
    setReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    let next: InvestorSession;
    try {
      const response = await apiFetch<SessionResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      next = { user: response.user, tokens: response.tokens };
    } catch {
      if (email.toLowerCase() !== 'asha.rao@client.dev' || password !== 'Password123!') {
        throw new Error('Demo credentials are asha.rao@client.dev / Password123!');
      }
      next = {
        user: { id: 'demo-investor', email, fullName: 'Asha Rao', role: 'CLIENT' },
        tokens: { accessToken: 'demo-investor-token', refreshToken: 'demo-investor-refresh', expiresInSeconds: 3600 },
      };
    }
    writeSession(next);
    setSession(next);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    let next: InvestorSession;
    try {
      const response = await apiFetch<SessionResponse>('/auth/register/client', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      next = { user: response.user, tokens: response.tokens };
    } catch {
      next = {
        user: { id: 'demo-investor-new', email: input.email, fullName: input.fullName, role: 'CLIENT' },
        tokens: { accessToken: 'demo-investor-token', refreshToken: 'demo-investor-refresh', expiresInSeconds: 3600 },
      };
    }
    writeSession(next);
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    writeSession(null);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, ready, login, register, logout }),
    [session, ready, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
