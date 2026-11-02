/**
 * Domain enums shared across all WealthOS apps.
 * Values are stable wire-format strings — do not rename without a migration.
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  ADVISOR = 'ADVISOR',
  CLIENT = 'CLIENT',
}

/**
 * Commission tier for ADVISOR users; also the key into the shared
 * COMMISSION_RATE_BPS rate table.
 */
export enum AdvisorTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
}

/** Risk label for Wealth Baskets. */
export enum BasketRisk {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
}


export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum AssetType {
  MUTUAL_FUND = 'MUTUAL_FUND',
  EQUITY = 'EQUITY',
  BOND = 'BOND',
  FIXED_DEPOSIT = 'FIXED_DEPOSIT',
  INSURANCE = 'INSURANCE',
}

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  SIP = 'SIP',
  SWITCH = 'SWITCH',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
}

/**
 * Digital KYC pipeline states, in strict ordinal order:
 * INITIATED → PAN_VALIDATED → DIGILOCKER_SYNCED → AADHAAR_ESIGNED →
 * VIDEO_KYC_PENDING → COMPLETED
 */
export enum KycState {
  INITIATED = 'INITIATED',
  PAN_VALIDATED = 'PAN_VALIDATED',
  DIGILOCKER_SYNCED = 'DIGILOCKER_SYNCED',
  AADHAAR_ESIGNED = 'AADHAAR_ESIGNED',
  VIDEO_KYC_PENDING = 'VIDEO_KYC_PENDING',
  COMPLETED = 'COMPLETED',
}

export enum KycEventKind {
  STATE_TRANSITION = 'STATE_TRANSITION',
  ADAPTER_CALLBACK = 'ADAPTER_CALLBACK',
}

export enum CommissionKind {
  UPFRONT = 'UPFRONT',
  TRAIL = 'TRAIL',
}

export enum SipStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum SipInstanceStatus {
  SCHEDULED = 'SCHEDULED',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
  MISSED = 'MISSED',
}

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  CONVERTED = 'CONVERTED',
  LOST = 'LOST',
}

export enum CasUploadStatus {
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}
