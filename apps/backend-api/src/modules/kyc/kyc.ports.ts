/** KYC adapter ports (Module A2) — each third-party surface is mockable. */

export interface PanValidationResult {
  ok: boolean;
  /** Masked PAN safe for storage + display (e.g. "XXXXX2672L"). */
  maskedPan: string;
  reason?: string;
}

export interface PanValidationAdapter {
  /**
   * @param pan 10-char PAN, uppercase alphanumeric
   */
  validate(pan: string): Promise<PanValidationResult>;
}

export interface DigiLockerSyncResult {
  ok: boolean;
  docId: string;
  issuedAt: string;
}

export interface DigiLockerAdapter {
  /** Emulates the DigiLocker webhook document-sync verification. */
  syncDocuments(userId: string): Promise<DigiLockerSyncResult>;
}

export interface AadhaarEsignResult {
  ok: boolean;
  esignRef: string;
}

export interface AadhaarEsignAdapter {
  /** Returns a signed e-Sign reference (mock provider in dev). */
  esign(userId: string, maskedAadhaar: string): Promise<AadhaarEsignResult>;
}

export interface VideoKycScheduled {
  ok: boolean;
  meetingUrl: string;
  scheduledAt: string;
}

export interface VideoKycAdapter {
  schedule(userId: string): Promise<VideoKycScheduled>;
  complete(webhookToken: string): Promise<{ ok: boolean; decision: 'APPROVED' | 'REJECTED' }>;
}
