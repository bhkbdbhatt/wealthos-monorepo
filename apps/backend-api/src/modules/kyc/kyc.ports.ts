/** KYC adapter ports (Module A2) — each third-party surface is mockable. */

export interface PanValidationResult {
  ok: boolean;
  /** Masked PAN safe for storage + display (e.g. "XXXXX2672L"). */
  maskedPan: string;
  reason?: string;
}

export abstract class PanValidationAdapter {
  /**
   * @param pan 10-char PAN, uppercase alphanumeric
   */
  abstract validate(pan: string): Promise<PanValidationResult>;
}

export interface DigiLockerSyncResult {
  ok: boolean;
  docId: string;
  issuedAt: string;
}

export abstract class DigiLockerAdapter {
  /** Emulates the DigiLocker webhook document-sync verification. */
  abstract syncDocuments(userId: string): Promise<DigiLockerSyncResult>;
}

export interface AadhaarEsignResult {
  ok: boolean;
  esignRef: string;
}

export abstract class AadhaarEsignAdapter {
  /** Returns a signed e-Sign reference (mock provider in dev). */
  abstract esign(userId: string, maskedAadhaar: string): Promise<AadhaarEsignResult>;
}

export interface VideoKycScheduled {
  ok: boolean;
  meetingUrl: string;
  scheduledAt: string;
}

export abstract class VideoKycAdapter {
  abstract schedule(userId: string): Promise<VideoKycScheduled>;
  abstract complete(webhookToken: string): Promise<{ ok: boolean; decision: 'APPROVED' | 'REJECTED' }>;
}
