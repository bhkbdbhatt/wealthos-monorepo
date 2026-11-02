import type { IsoTimestamp, Json } from './api';
import { KycState, UserRole, UserStatus } from '../enums';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: IsoTimestamp;
}

export interface KycStateDto {
  userId: string;
  state: KycState;
  panMasked: string | null;
  rejectionReason: string | null;
  updatedAt: IsoTimestamp;
}

export interface AuditEntryDto<K extends string = KycState> {
  fromState: K | null;
  toState: K | null;
  meta?: Json;
  at: IsoTimestamp;
}
