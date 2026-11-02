/* eslint-disable no-console */
/**
 * Pure seed-plan builder: constructs every row deterministically so the data is
 * reviewable and testable before it touches the database.
 */
import {
  AssetType,
  BasketRisk,
  CasUploadStatus,
  CommissionKind,
  AdvisorTier,
  KycState,
  LeadStatus,
  UserRole,
  SipInstanceStatus,
  SipStatus,
  TransactionType,
} from '@wealthos/shared-types';
import { type SeededRandom, createSeededRandom } from './faker';

export const SEED_PASSWORD_PLAINTEXT = 'Password123!';

export interface SeedAsset {
  slug: string;
  name: string;
  type: AssetType;
  schemeCode: string;
  issuer: string;
  category: string;
  navPaise: number;
  navHistory: Array<{ date: Date; navPaise: number }>;
}

export interface SeedUser {
  email: string;
  fullName: string;
  role: UserRole;
  tier?: AdvisorTier;
  ownerAdvisorEmail?: string;
  phonePlain?: string;
  kyc?: { state: KycState; panFull: string; panMasked: string };
}

export interface SeedTransaction {
  ownerEmail: string;
  assetSlug: string;
  type: TransactionType;
  amountPaise: number;
  units8: string;
  navPaise: number;
  executedAt: Date;
}

export interface SeedSipInstance {
  scheduledFor: Date;
  amountPaise: number;
  status: SipInstanceStatus;
}

export interface SeedSip {
  ownerEmail: string;
  assetSlug: string;
  monthlyAmountPaise: number;
  intervalsPerMonth: number;
  scheduledDays: number[];
  status: SipStatus;
  startOn: Date;
  endOn: Date | null;
  nextRunOn: Date | null;
  instances: SeedSipInstance[];
}

export interface SeedCommission {
  advisorEmail: string;
  clientEmail: string;
  assetType: AssetType;
  kind: CommissionKind;
  rateBps: number;
  amountPaise: number;
  periodKey: string;
  transactionIndex: number | null;
}

export interface SeedGoal {
  ownerEmail: string;
  name: string;
  targetAmountPaise: number;
  horizonMonths: number;
  expectedAnnualReturnBps: number;
  recommendedMonthlyPaise: number;
  startDate: Date;
}

export interface SeedBasket {
  slug: string;
  name: string;
  description: string;
  category: string;
  riskLevel: BasketRisk;
  items: Array<{ assetSlug: string; targetWeightPct: number }>;
}

export interface SeedLead {
  profileUsername: string;
  name: string;
  phonePlain: string;
  email?: string;
  message?: string;
  status: LeadStatus;
}

export interface SeedSegment {
  ownerEmail: string;
  name: string;
  description: string;
  rule: unknown;
}

export interface SeedCasUpload {
  ownerEmail: string;
  fileName: string;
  sizeBytes: number;
  parserVersion: string;
  status: CasUploadStatus;
  transactionsImported: number;
  duplicatesSkipped: number;
  createdAt: Date;
}

export interface SeedPartnerProfile {
  ownerEmail: string;
  username: string;
  orgName: string;
  tagline: string;
  bio: string;
  specialties: string[];
  yearsExperience: number;
}

export interface SeedPlan {
  passwordPlaintext: string;
  users: SeedUser[];
  assets: SeedAsset[];
  transactions: SeedTransaction[];
  sips: SeedSip[];
  commissions: SeedCommission[];
  goals: SeedGoal[];
  baskets: SeedBasket[];
  leads: SeedLead[];
  segments: SeedSegment[];
  casUploads: SeedCasUpload[];
  partnerProfile: SeedPartnerProfile;
}

const ADVISORS: Array<{ email: string; fullName: string; tier: AdvisorTier; phone: string }> = [
  { email: 'nirav@wealthos.dev', fullName: 'Nirav Pathak', tier: AdvisorTier.SILVER, phone: '9876500010' },
  { email: 'ananya@wealthos.dev', fullName: 'Ananya Sharma', tier: AdvisorTier.SILVER, phone: '9876500011' },
];

const CLIENT_FULL_NAMES = [
  'Rohit Verma',
  'Priya Nair',
  'Arjun Mehta',
  'Sneha Reddy',
  'Karthik Iyer',
  'Divya Kulkarni',
  'Amit Bansal',
  'Pooja Joshi',
  'Vikram Singh',
  'Neha Chawla',
  'Sanjay Gupta',
  'Meera Pillai',
];

const CLIENT_KYC_STATES: KycState[] = [
  KycState.COMPLETED,
  KycState.COMPLETED,
  KycState.COMPLETED,
  KycState.VIDEO_KYC_PENDING,
  KycState.COMPLETED,
  KycState.PAN_VALIDATED,
  KycState.COMPLETED,
  KycState.DIGILOCKER_SYNCED,
  KycState.COMPLETED,
  KycState.INITIATED,
  KycState.COMPLETED,
  KycState.AADHAAR_ESIGNED,
];

const ASSET_BLUEPRINTS = [
  { slug: 'hdfc-top-200-fund', name: 'HDFC Top 200 Fund', type: AssetType.MUTUAL_FUND, issuer: 'HDFC Mutual Fund', category: 'Large Cap', startNav: 72500 },
  { slug: 'icici-pru-bluechip-fund', name: 'ICICI Prudential Bluechip Fund', type: AssetType.MUTUAL_FUND, issuer: 'ICICI Prudential AMC', category: 'Large Cap', startNav: 98000 },
  { slug: 'hdfc-midcap-opportunities', name: 'HDFC Mid-Cap Opportunities Fund', type: AssetType.MUTUAL_FUND, issuer: 'HDFC Mutual Fund', category: 'Mid Cap', startNav: 15200 },
  { slug: 'sbi-small-cap-fund', name: 'SBI Small Cap Fund', type: AssetType.MUTUAL_FUND, issuer: 'SBI Mutual Fund', category: 'Small Cap', startNav: 8900 },
  { slug: 'axis-hybrid-series', name: 'Axis Bluechip Hybrid Series I', type: AssetType.MUTUAL_FUND, issuer: 'Axis Mutual Fund', category: 'Hybrid', startNav: 23400 },
  { slug: 'nhai-gilt-bond-2043', name: 'NHAI Gilt Bond 2043', type: AssetType.BOND, issuer: 'NHAI', category: 'Government', startNav: 11450 },
  { slug: 'sbi-fd-8-1', name: 'SBI Fixed Deposit 8.1% / 700 days', type: AssetType.FIXED_DEPOSIT, issuer: 'State Bank of India', category: 'FD', startNav: 1000 },
  { slug: 'lic-shubh-nivesh', name: 'LIC Shubh Nivesh Endowment', type: AssetType.INSURANCE, issuer: 'LIC of India', category: 'Endowment', startNav: 15250 },
] as const;

const SIP_AMOUNTS = [200000, 300000, 500000, 1000000];
const LUMP_AMOUNTS = [250000, 500000, 1000000, 1500000, 2500000];

function buildNavSeries(startNavPaise: number, tradingDays: number, rand: SeededRandom): Array<{ date: Date; navPaise: number }> {
  const points: Array<{ date: Date; navPaise: number }> = [];
  let nav = startNavPaise;
  const cursor = new Date(Date.UTC(2024, 6, 1));
  while (points.length < tradingDays) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      points.push({ date: new Date(cursor.getTime()), navPaise: Math.max(1, nav) });
      const drift = rand.next() * 0.004 - 0.0019;
      nav = Math.round(nav * (1 + drift));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}

function unitsFor(amountPaise: number, navPaise: number): string {
  return (amountPaise / navPaise).toFixed(8);
}

export function buildSeedPlan(): SeedPlan {
  const rand = createSeededRandom(20260202);
  const today = new Date();

  const advisorOnline = ADVISORS.map((a) => ({
    email: a.email,
    fullName: a.fullName,
    role: UserRole.ADVISOR,
    tier: a.tier,
    phonePlain: a.phone,
  })) satisfies SeedUser[];

  const mutFunds = ASSET_BLUEPRINTS.map((bp) => ({ ...bp }));
  const investable: string[] = [
    mutFunds[0].slug,
    mutFunds[1].slug,
    mutFunds[2].slug,
    mutFunds[3].slug,
    mutFunds[4].slug,
    mutFunds[5].slug,
  ];

  const clients: SeedUser[] = CLIENT_FULL_NAMES.map((fullName, idx) => {
    const owner = ADVISORS[idx % ADVISORS.length] as (typeof ADVISORS)[number];
    const ownerEmail = owner.email;
    const state = CLIENT_KYC_STATES[idx] ?? KycState.INITIATED;
    return {
      email: `${fullName.toLowerCase().replace(/\s+/g, '.')}@client.dev`,
      fullName,
      role: UserRole.CLIENT,
      ownerAdvisorEmail: ownerEmail,
      phonePlain: `98${String(86000000 + idx * 7333)}`.slice(0, 10),
      kyc: {
        state,
        panFull: `ABCPD2${551 + idx}L`,
        panMasked: `XXXXX2${551 + idx}L`,
      },
    };
  });

  const users: SeedUser[] = [
    {
      email: 'admin@wealthos.dev',
      fullName: 'WealthOS Admin',
      role: UserRole.ADMIN,
      phonePlain: '9876500000',
    },
    ...advisorOnline,
    ...clients,
  ];

  const assets: SeedAsset[] = ASSET_BLUEPRINTS.map((bp) => {
    const points = buildNavSeries(bp.startNav, 520, rand);
    const latest = points[points.length - 1] as { navPaise: number };
    return {
      slug: bp.slug,
      name: bp.name,
      type: bp.type,
      schemeCode: `${bp.slug.slice(0, 10).toUpperCase()}-CND`,
      issuer: bp.issuer,
      category: bp.category,
      navPaise: latest.navPaise,
      navHistory: points,
    };
  });

  const transactions: SeedTransaction[] = [];
  clients.forEach((client) => {
    const buysThisClient = 8 + rand.int(0, 4);
    for (let i = 0; i < buysThisClient; i++) {
      const slug = rand.pick(investable) as string;
      const monthsBack = rand.int(2, 24);
      const executedAt = new Date(today.getTime());
      executedAt.setUTCDate(1);
      executedAt.setUTCMonth(executedAt.getUTCMonth() - monthsBack);
      executedAt.setUTCDate(rand.int(1, 28));
      const asset = assets.find((a) => a.slug === slug) as SeedAsset;
      const navOnDate =
        (asset.navHistory.slice().reverse().find((p) => p.date.getTime() <= executedAt.getTime()) ??
          (asset.navHistory[0] as { date: Date; navPaise: number }));
      const amountPaise = rand.pick(LUMP_AMOUNTS) as number;
      transactions.push({
        ownerEmail: client.email,
        assetSlug: slug,
        type: TransactionType.BUY,
        amountPaise,
        units8: unitsFor(amountPaise, navOnDate.navPaise),
        navPaise: navOnDate.navPaise,
        executedAt,
      });
      if (rand.next() < 0.08) {
        const sellAmount = Math.floor(amountPaise / 4);
        transactions.push({
          ownerEmail: client.email,
          assetSlug: slug,
          type: TransactionType.SELL,
          amountPaise: sellAmount,
          units8: unitsFor(sellAmount, navOnDate.navPaise),
          navPaise: navOnDate.navPaise,
          executedAt,
        });
      }
    }
  });

  const sips: SeedSip[] = clients.slice(0, 8).map((client, idx) => {
    const intervals = [1, 2, 3][idx % 3] as number;
    const days = intervals === 1 ? [5] : intervals === 2 ? [5, 20] : [1, 11, 21];
    const startOn = new Date(Date.UTC(2025, 8, 1));
    const monthlyAmountPaise = SIP_AMOUNTS[idx % SIP_AMOUNTS.length] as number;
    return {
      ownerEmail: client.email,
      assetSlug: investable[idx % investable.length] as string,
      monthlyAmountPaise,
      intervalsPerMonth: intervals,
      scheduledDays: days,
      status: SipStatus.ACTIVE,
      startOn,
      endOn: null,
      nextRunOn: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), days[idx % days.length] as number)),
      instances: Array.from({ length: 6 }, (_v, i) => {
        const month = new Date(startOn.getTime());
        month.setUTCMonth(month.getUTCMonth() + Math.floor(i / intervals));
        month.setUTCDate(days[i % days.length] as number);
        return {
          scheduledFor: month,
          amountPaise: Math.floor(monthlyAmountPaise / intervals),
          status: SipInstanceStatus.EXECUTED,
        };
      }),
    };
  });

  const commissions: SeedCommission[] = [];
  const buyIndices: number[] = [];
  transactions.forEach((t, i) => {
    if (t.type === TransactionType.BUY) buyIndices.push(i);
  });
  buyIndices
    .slice(0, 40)
    .forEach((txnIndex) => {
      const txn = transactions[txnIndex] as SeedTransaction;
      const client = clients.find((c) => c.email === txn.ownerEmail) as SeedUser;
      const advisorEmail = client.ownerAdvisorEmail as string;
      commissions.push({
        advisorEmail,
        clientEmail: client.email,
        assetType: AssetType.MUTUAL_FUND,
        kind: CommissionKind.UPFRONT,
        rateBps: 100,
        amountPaise: Math.floor((txn.amountPaise * 100) / 10_000),
        periodKey: `T:${txnIndex}`,
        transactionIndex: txnIndex,
      });
    });
  const trailMonths = ['2025-11', '2025-12', '2026-01'];
  clients
    .filter((c) => c.role === UserRole.CLIENT && c.ownerAdvisorEmail)
    .forEach((client) => {
      trailMonths.forEach((month) => {
        commissions.push({
          advisorEmail: client.ownerAdvisorEmail as string,
          clientEmail: client.email,
          assetType: AssetType.MUTUAL_FUND,
          kind: CommissionKind.TRAIL,
          rateBps: 50,
          amountPaise: 180000 + rand.int(0, 9000) * 100,
          periodKey: `M:${month}@${client.email}`,
          transactionIndex: null,
        });
      });
    });

  const goals: SeedGoal[] = clients.slice(0, 6).map((client, idx) => {
    const names = ['House Down Payment', 'Child Education Corpus', 'Retirement 2046', 'Wedding Fund', 'Emergency Cushion', 'Second Car Fund'];
    const target = [100000000, 250000000, 400000000][idx % 3] as number;
    const horizon = [60, 108, 180][idx % 3] as number;
    const retBps = [1100, 1300, 1500][idx % 3] as number;
    const r = retBps / 1_000_000; // monthly growth factor
    const n = horizon;
    const monthlyPaise = Math.round((target * r) / (Math.pow(1 + r, n) - 1));
    return {
      ownerEmail: client.email,
      name: names[idx] as string,
      targetAmountPaise: target,
      horizonMonths: horizon,
      expectedAnnualReturnBps: retBps,
      recommendedMonthlyPaise: monthlyPaise,
      startDate: new Date(Date.UTC(2025, 7, 1)),
    };
  });

  const baskets: SeedBasket[] = [
    {
      slug: 'blue-chip-collector',
      name: 'Blue Chip Collector',
      description: 'Large-cap stability with iconic franchises for core wealth building.',
      category: 'Equity',
      riskLevel: BasketRisk.MODERATE,
      items: [
        { assetSlug: 'hdfc-top-200-fund', targetWeightPct: 50 },
        { assetSlug: 'icici-pru-bluechip-fund', targetWeightPct: 50 },
      ],
    },
    {
      slug: 'mid-small-starter',
      name: 'Mid & Small Starter',
      description: 'Growth-engine basket tilted to mid- and small-cap funds.',
      category: 'Equity',
      riskLevel: BasketRisk.HIGH,
      items: [
        { assetSlug: 'hdfc-midcap-opportunities', targetWeightPct: 60 },
        { assetSlug: 'sbi-small-cap-fund', targetWeightPct: 40 },
      ],
    },
    {
      slug: 'wealth-shield-defensive',
      name: 'Wealth Shield (Defensive)',
      description: 'Capital-preservation blend with gilt bonds, an FD and a hybrid fund.',
      category: 'Hybrid',
      riskLevel: BasketRisk.LOW,
      items: [
        { assetSlug: 'nhai-gilt-bond-2043', targetWeightPct: 40 },
        { assetSlug: 'sbi-fd-8-1', targetWeightPct: 30 },
        { assetSlug: 'axis-hybrid-series', targetWeightPct: 30 },
      ],
    },
  ];

  const leads: SeedLead[] = [
    { profileUsername: 'nirav-pathak', name: 'Rakesh Dhawan', phonePlain: '9876511111', email: 'rakesh@example.com', message: 'I want to start an SIP for my daughter.', status: LeadStatus.NEW },
    { profileUsername: 'nirav-pathak', name: 'Farah Ali', phonePlain: '9876522222', message: 'Suggest low-risk options for one lakh.', status: LeadStatus.CONTACTED },
    { profileUsername: 'nirav-pathak', name: 'Mohan Kapoor', phonePlain: '9876533333', email: 'mohan@example.com', status: LeadStatus.NEW },
    { profileUsername: 'nirav-pathak', name: 'Silpa Das', phonePlain: '9876544444', message: 'Looking for retirement planning help.', status: LeadStatus.LOST },
    { profileUsername: 'nirav-pathak', name: 'Dev Manchanda', phonePlain: '9876555555', status: LeadStatus.CONVERTED },
  ];

  const segments: SeedSegment[] = [
    {
      ownerEmail: 'nirav@wealthos.dev',
      name: 'High AUM, KYC Complete',
      description: 'AUM above Rs 5L with completed KYC',
      rule: {
        root: {
          combinator: 'AND',
          conditions: [
            { field: 'current_value_paise', operator: 'GT', value: 50000000 },
            { field: 'kyc_state', operator: 'EQ', value: 'COMPLETED' },
          ],
        },
      },
    },
    {
      ownerEmail: 'nirav@wealthos.dev',
      name: 'Pending KYC Follow-ups',
      description: 'All clients not yet fully KYC-verified',
      rule: {
        root: { combinator: 'AND', conditions: [{ field: 'kyc_state', operator: 'NEQ', value: 'COMPLETED' }] },
      },
    },
  ];

  const casUploads: SeedCasUpload[] = [
    {
      ownerEmail: clients[0]?.email as string,
      fileName: 'cas-statement-2026-01.pdf',
      sizeBytes: 214980,
      parserVersion: 'cams-v1',
      status: CasUploadStatus.SUCCESS,
      transactionsImported: 18,
      duplicatesSkipped: 2,
      createdAt: new Date(Date.UTC(2026, 0, 15)),
    },
    {
      ownerEmail: clients[2]?.email as string,
      fileName: 'karvy-cas-broken.pdf',
      sizeBytes: 9812,
      parserVersion: 'karvy-v1',
      status: CasUploadStatus.FAILED,
      transactionsImported: 0,
      duplicatesSkipped: 0,
      createdAt: new Date(Date.UTC(2026, 1, 2)),
    },
  ];

  const partnerProfile: SeedPartnerProfile = {
    ownerEmail: 'nirav@wealthos.dev',
    username: 'nirav-pathak',
    orgName: 'Pathak Wealth Desk',
    tagline: 'Goal-first investing, zero jargon.',
    bio: 'AMFI-certified advisor helping families build wealth via SIPs, baskets and insurance. 10+ years serving clients across Delhi NCR.',
    specialties: ['Retirement Planning', 'Tax Harvesting', 'Insurance Planning'],
    yearsExperience: 10,
  };

  return {
    passwordPlaintext: SEED_PASSWORD_PLAINTEXT,
    users,
    assets,
    transactions,
    sips,
    commissions,
    goals,
    baskets,
    leads,
    segments,
    casUploads,
    partnerProfile,
  };
}
