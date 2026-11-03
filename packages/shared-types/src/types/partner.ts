import type { LeadStatus } from '../enums';
import type { IsoTimestamp } from './api';

export interface PartnerDto {
  id: string;
  username: string;
  orgName: string;
  tagline: string | null;
  bio: string | null;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  specialties: string[];
  yearsExperience: number;
  active: boolean;
}

export interface UpsertPartnerInput {
  orgName: string;
  tagline?: string;
  bio?: string;
  photoUrl?: string;
  phone?: string;
  website?: string;
  specialties?: string[];
  yearsExperience?: number;
  active?: boolean;
}

export interface LeadDto {
  id: string;
  partnerId: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  status: LeadStatus;
  createdAt: IsoTimestamp;
}

export interface CaptureLeadInput {
  name: string;
  phone: string;
  email?: string;
  message?: string;
}
