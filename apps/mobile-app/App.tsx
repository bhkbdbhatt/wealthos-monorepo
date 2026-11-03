import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { PortfolioSummary } from '@wealthos/shared-types';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000/api/v1';

interface Session {
  accessToken: string;
  fullName: string;
}

interface LoginResponse {
  user: { fullName: string };
  tokens: { accessToken: string; refreshToken: string; expiresInSeconds: number };
}

function rupees(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export default function App() {
  const [email, setEmail] = useState('asha.rao@client.dev');
  const [password, setPassword] = useState('Password123!');
  const [session, setSession] = useState<Session | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as LoginResponse | { error?: { message?: string } };
      if (!response.ok || !('tokens' in payload)) {
        setError('error' in payload ? (payload.error?.message ?? 'Sign in failed') : 'Sign in failed');
        return;
      }
      const next = { accessToken: payload.tokens.accessToken, fullName: payload.user.fullName };
      setSession(next);
      await loadPortfolio(next.accessToken);
    } catch {
      setError('Could not reach the WealthOS API');
    } finally {
      setBusy(false);
    }
  }

  async function loadPortfolio(token: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/portfolios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setError('Could not load your portfolio');
        return;
      }
      setPortfolio((await response.json()) as PortfolioSummary);
    } catch {
      setError('Could not reach the WealthOS API');
    } finally {
      setBusy(false);
    }
  }

  if (session === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.auth}>
          <Text style={styles.brand}>WealthOS</Text>
          <Text style={styles.heading}>Your portfolio, in your pocket.</Text>
          <Text style={styles.subheading}>Sign in with your investor account.</Text>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primary} onPress={() => void signIn()} disabled={busy}>
            {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>Sign in</Text>}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.dashboard}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>WealthOS</Text>
            <Text style={styles.subheading}>Hello, {session.fullName.split(' ')[0]}</Text>
          </View>
          <Pressable
            style={styles.secondary}
            onPress={() => {
              setSession(null);
              setPortfolio(null);
            }}
          >
            <Text style={styles.secondaryText}>Sign out</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {portfolio ? (
          <>
            <View style={styles.valueCard}>
              <Text style={styles.valueLabel}>Current value</Text>
              <Text style={styles.value}>{rupees(portfolio.currentPaise)}</Text>
              <Text style={styles.valueHint}>
                Invested {rupees(portfolio.investedPaise)} / XIRR {portfolio.xirrPct === null ? '-' : `${portfolio.xirrPct}%`}
              </Text>
            </View>
            <Text style={styles.sectionTitle}>Allocation</Text>
            {portfolio.allocationByType.map((slice) => (
              <View key={slice.type} style={styles.allocationRow}>
                <Text style={styles.allocationLabel}>{slice.type.replaceAll('_', ' ')}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, slice.weightPct))}%` }]} />
                </View>
                <Text style={styles.allocationPct}>{slice.weightPct.toFixed(1)}%</Text>
              </View>
            ))}
            <Text style={styles.sectionTitle}>Holdings</Text>
            {portfolio.holdings.map((holding) => (
              <View key={holding.holdingId} style={styles.holding}>
                <View style={styles.holdingInfo}>
                  <Text style={styles.holdingName}>{holding.asset.name}</Text>
                  <Text style={styles.holdingMeta}>
                    {Number(holding.units).toFixed(3)} units / {holding.asset.type.replaceAll('_', ' ')}
                  </Text>
                </View>
                <View>
                  <Text style={styles.holdingValue}>{rupees(holding.currentPaise)}</Text>
                  <Text style={holding.gainPaise >= 0 ? styles.gain : styles.loss}>{rupees(holding.gainPaise)}</Text>
                </View>
              </View>
            ))}
            <Pressable style={styles.primary} onPress={() => void loadPortfolio(session.accessToken)} disabled={busy}>
              {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>Refresh</Text>}
            </Pressable>
          </>
        ) : (
          <ActivityIndicator style={styles.loader} color="#047857" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  auth: { padding: 24, paddingTop: 72 },
  dashboard: { padding: 20, paddingBottom: 40 },
  brand: { color: '#047857', fontSize: 20, fontWeight: '700' },
  heading: { marginTop: 28, color: '#0f172a', fontSize: 30, fontWeight: '700', lineHeight: 36 },
  subheading: { marginTop: 8, color: '#64748b', fontSize: 14 },
  label: { marginTop: 20, marginBottom: 6, color: '#334155', fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0f172a',
  },
  primary: {
    marginTop: 24,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#047857',
    paddingVertical: 14,
  },
  primaryText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  error: { marginTop: 14, color: '#b91c1c', fontSize: 13 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  valueCard: { marginTop: 24, borderRadius: 16, backgroundColor: '#0f172a', padding: 20 },
  valueLabel: { color: '#94a3b8', fontSize: 13 },
  value: { marginTop: 6, color: '#ffffff', fontSize: 32, fontWeight: '700' },
  valueHint: { marginTop: 6, color: '#cbd5e1', fontSize: 12 },
  sectionTitle: { marginTop: 24, marginBottom: 10, color: '#0f172a', fontSize: 16, fontWeight: '700' },
  allocationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  allocationLabel: { width: 108, color: '#475569', fontSize: 12 },
  barTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 999, backgroundColor: '#047857' },
  allocationPct: { width: 52, textAlign: 'right', color: '#64748b', fontSize: 12 },
  holding: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 14,
    marginBottom: 10,
  },
  holdingInfo: { flex: 1, paddingRight: 8 },
  holdingName: { color: '#0f172a', fontSize: 14, fontWeight: '600' },
  holdingMeta: { marginTop: 2, color: '#64748b', fontSize: 11 },
  holdingValue: { color: '#0f172a', fontSize: 14, fontWeight: '600', textAlign: 'right' },
  gain: { marginTop: 2, color: '#047857', fontSize: 11, textAlign: 'right' },
  loss: { marginTop: 2, color: '#dc2626', fontSize: 11, textAlign: 'right' },
  loader: { marginTop: 40 },
});
