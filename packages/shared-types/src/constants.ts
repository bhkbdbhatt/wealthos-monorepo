/**
 * Feature flags are constants, not live toggles — flip in code, never at runtime.
 * Every flag has a short rationale so future removal is mechanical.
 */
import { type AdvisorTierName } from './types/commission';
import { type AssetType, type CommissionKind } from './enums';

export const FEATURE_FLAGS = {
  /** White-label partner landing pages (B3) */
  PARTNER_LANDING: true,
  /** CAS-imported historical positions feed portfolio display (A4) */
  CAS_IMPORT: true,
  /** Wealth Baskets purchase flow (C2) */
  BASKETS_ENABLED: true,
  /** Goal Mapper recommendations (C2) */
  GOAL_MAPPER: true,
  /** Multi-day SIP mandate splitting (A3) */
  MULTI_DAY_SIP: true,
  /** CSV export of segments (B2) */
  SEGMENT_CSV_EXPORT: true,
} as const;

export type FeatureFlagName = keyof typeof FEATURE_FLAGS;

/** Commission rates in basis points (1 bps = 0.01%), keyed by asset class and advisor tier. */
export const COMMISSION_RATE_BPS: Record<
  AssetType,
  Record<CommissionKind, Record<AdvisorTierName, number>>
> = {
  MUTUAL_FUND: {
    UPFRONT: { BRONZE: 50, SILVER: 100, GOLD: 150 },
    TRAIL: { BRONZE: 30, SILVER: 50, GOLD: 80 },
  },
  EQUITY: {
    UPFRONT: { BRONZE: 10, SILVER: 20, GOLD: 30 },
    TRAIL: { BRONZE: 5, SILVER: 10, GOLD: 15 },
  },
  BOND: {
    UPFRONT: { BRONZE: 20, SILVER: 40, GOLD: 60 },
    TRAIL: { BRONZE: 10, SILVER: 20, GOLD: 30 },
  },
  FIXED_DEPOSIT: {
    UPFRONT: { BRONZE: 15, SILVER: 25, GOLD: 40 },
    TRAIL: { BRONZE: 0, SILVER: 0, GOLD: 0 },
  },
  INSURANCE: {
    UPFRONT: { BRONZE: 100, SILVER: 150, GOLD: 200 },
    TRAIL: { BRONZE: 20, SILVER: 40, GOLD: 60 },
  },
};

/** Supported multi-day monthly SIP split sizes (A3): 1, 2, 3 debits/month. */
export const SIP_SPLIT_OPTIONS = [1, 2, 3] as const;

/** IST midnight offset in minutes for crons (IST = UTC+5:30). */
export const IST_OFFSET_MINUTES = 330;

/** Token bucket for endpoints: role → actions they may call. Kept here so both web apps can hide UI links too. */
export const RBAC_MATRIX = {
  ADMIN: ['*'],
  ADVISOR: ['portfolio:read:own-clients', 'segments:manage', 'analytics:read', 'partners:manage', 'leads:manage', 'pan:validate', 'cas:upload:own-clients'],
  CLIENT: ['portfolio:read:self', 'transactions:create:self', 'sip:manage:self', 'goals:manage:self', 'baskets:buy', 'cas:upload:self', 'kyc:submit:self'],
} as const;
