import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaKycRecord } from './kyc.types';
import { PrismaService } from '@wealthos/database';
import { KycState, type KycEventKind } from '@wealthos/shared-types';
import { applyKycEvent } from '../../domain/kyc-state-machine';
import { PiiCipher } from '../../../core/pii-cipher';
import {
  AadhaarEsignAdapter,
  DigiLockerAdapter,
  PanValidationAdapter,
  VideoKycAdapter,
} from './kyc.ports';

/** Prisma KycRecord row alias (decoupled from $Enums strings). */
export type { PrismaKycRecord };

export interface KycStateResponse {
  userId: string;
  state: KycState;
  panMasked: string | null;
  rejectionReason: string | null;
  updatedAt: string;
}

export interface KycTimelineEntry {
  kind: KycEventKind;
  fromState: string | null;
  toState: string | null;
  at: string;
}

/**
 * KYC pipeline orchestration (A2): state machine + audit log.
 * Third-party adapters are ports injected in the KYC module factory.
 */
@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly panAdapter: PanValidationAdapter,
    private readonly digilocker: DigiLockerAdapter,
    private readonly esign: AadhaarEsignAdapter,
    private readonly videoKyc: VideoKycAdapter,
    private readonly piiCipher: PiiCipher,
  ) {}

  /**
   * Ensures a KycRecord exists (INITIATED) and returns its state.
   * @param userId owner id
   */
  async getState(userId: string): Promise<KycStateResponse> {
    const record = await this.ensureRecord(userId);
    return {
      userId: record.userId,
      state: record.state,
      panMasked: record.panMasked,
      rejectionReason: record.rejectionReason,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  /** @param userId timeline of audit rows, newest last. */
  async timeline(userId: string): Promise<KycTimelineEntry[]> {
    const record = await this.ensureRecord(userId);
    const events = await this.prisma.kycEvent.findMany({
      where: { kycId: record.id },
      orderBy: [{ createdAt: 'asc' }],
    });
    return events.map((e) => ({
      kind: e.kind as KycEventKind,
      fromState: e.fromState,
      toState: e.toState,
      at: e.createdAt.toISOString(),
    }));
  }

  /**
   * Step 1 — validate + persist PAN (encrypted), transitions INITIATED → PAN_VALIDATED.
   * @param userId owner
   * @param rawPan plaintext PAN (only in memory, never logged)
   */
  async validatePan(userId: string, rawPan: string): Promise<KycStateResponse> {
    const record = await this.ensureRecord(userId);
    if (record.state !== KycState.INITIATED && record.state !== KycState.PAN_VALIDATED) {
      throw new ConflictException(`PAN validation not allowed in state ${record.state}`);
    }
    const result = await this.panAdapter.validate(rawPan);
    if (!result.ok) throw new BadRequestException(result.reason ?? 'PAN validation failed');
    const updated = await this.applyEvent(record.id, record.state, 'PAN_VALIDATED', {
      panEnc: this.piiCipher.encrypt(rawPan),
      panMasked: result.maskedPan,
    });
    return this.toResponse(updated);
  }

  /** Step 2 — DigiLocker document sync (webhook-emulated). */
  async syncDigilocker(userId: string): Promise<KycStateResponse> {
    const record = await this.ensureRecord(userId);
    if (record.state !== KycState.PAN_VALIDATED && record.state !== KycState.DIGILOCKER_SYNCED) {
      throw new ConflictException(`DigiLocker sync requires PAN_VALIDATED (currently: ${record.state})`);
    }
    const sync = await this.digilocker.syncDocuments(userId);
    if (!sync.ok) throw new BadRequestException('DigiLocker sync rejected');
    const updated = await this.applyEvent(record.id, record.state, 'DIGILOCKER_SYNCED', {
      digilockerDocId: sync.docId,
    });
    return this.toResponse(updated);
  }

  /** Step 3 — Aadhaar e-Sign on the mandate pack. */
  async aadhaarEsign(userId: string, maskedAadhaar: string): Promise<KycStateResponse> {
    const record = await this.ensureRecord(userId);
    if (record.state !== KycState.DIGILOCKER_SYNCED && record.state !== KycState.AADHAAR_ESIGNED) {
      throw new ConflictException(`e-Sign requires DIGILOCKER_SYNCED (currently: ${record.state})`);
    }
    if (!/^[Xx*•]{8}\d{4}$/.test(maskedAadhaar)) {
      throw new BadRequestException('masked Aadhaar must look like XXXXXXXX1234');
    }
    const result = await this.esign.esign(userId, maskedAadhaar);
    if (!result.ok) throw new BadRequestException('e-Sign rejected');
    const updated = await this.applyEvent(record.id, record.state, 'AADHAAR_ESIGNED', {
      aadhaarEsignRef: result.esignRef,
    });
    return this.toResponse(updated);
  }

  /** Step 4 — schedule video KYC. */
  async scheduleVideoKyc(userId: string): Promise<KycStateResponse> {
    const record = await this.ensureRecord(userId);
    if (record.state !== KycState.AADHAAR_ESIGNED && record.state !== KycState.VIDEO_KYC_PENDING) {
      throw new ConflictException(`Video KYC requires AADHAAR_ESIGNED (currently: ${record.state})`);
    }
    const scheduled = await this.videoKyc.schedule(userId);
    if (!scheduled.ok) throw new BadRequestException('Video KYC scheduling failed');
    const updated = await this.applyEvent(record.id, record.state, 'VIDEO_KYC_SCHEDULED', {
      videoKycRef: scheduled.meetingUrl,
      videoKycScheduledAt: scheduled.scheduledAt,
    });
    return this.toResponse(updated);
  }

  /**
   * Async completion webhook (vendor → platform). Accepts the vendor token.
   * @param vendorRef videoKYC session reference stored during scheduling
   * @param token webhook token passed by the call operator
   */
  async completeVideoKyc(vendorRef: string, token: string): Promise<KycStateResponse> {
    const record = await this.recordByRef('videoKycRef', vendorRef);
    if (!record) throw new NotFoundException('No KYC session for this reference');
    if (record.state !== KycState.VIDEO_KYC_PENDING) {
      throw new ConflictException(`Webhook only applies in VIDEO_KYC_PENDING (currently: ${record.state})`);
    }
    const decision = await this.videoKyc.complete(token);
    if (decision.decision === 'REJECTED') {
      return this.toResponse(await this.applyEvent(record.id, record.state, 'KYC_REJECTED', { reason: 'Video KYC rejected' }));
    }
    return this.toResponse(await this.applyEvent(record.id, record.state, 'VIDEO_KYC_COMPLETED'));
  }

  async adminComplete(userId: string): Promise<KycStateResponse> {
    const record = await this.ensureRecord(userId);
    if (record.state === KycState.COMPLETED) return this.toResponse(record);
    return this.toResponse(await this.applyEvent(record.id, record.state, 'KYC_COMPLETED'));
  }

  /** Ensures a KYC record exists for the user (created as INITIATED on first use). */
  private async ensureRecord(userId: string): Promise<PrismaKycRecord> {
    const found = await this.prisma.kycRecord.findUnique({ where: { userId } });
    if (found) return snapshot(found);
    return snapshot(
      await this.prisma.kycRecord.create({
        data: {
          userId,
          state: KycState.INITIATED,
          events: { create: { kind: 'STATE_TRANSITION', fromState: null, toState: KycState.INITIATED } },
        },
      }),
    );
  }

  private async recordByRef(field: 'videoKycRef', value: string): Promise<PrismaKycRecord | null> {
    if (field !== 'videoKycRef') throw new Error('Unsupported ref field');
    const found = await this.prisma.kycRecord.findFirst({ where: { videoKycRef: value } });
    return found ? snapshot(found) : null;
  }

  /**
   * Central state-transition writer with audit row — the only path that mutates state.
   * @param recordId kyc record id
   * @param current current state (pre-read)
   * @param event domain event name
   * @param data additional column updates
   */
  private async applyEvent(
    recordId: string,
    current: KycState,
    event: Parameters<typeof applyKycEvent>[1],
    data: {
      panEnc?: string;
      panMasked?: string;
      digilockerDocId?: string;
      aadhaarEsignRef?: string;
      videoKycRef?: string;
      videoKycScheduledAt?: string;
      reason?: string;
    } = {},
  ): Promise<PrismaKycRecord> {
    const next = applyKycEvent(current, event);
    if (next === null) {
      throw new ConflictException(`Event ${event} not allowed from ${current}`);
    }
    const rejectionFields =
      next === KycState.INITIATED
        ? { rejectionReason: data.reason ?? 'Rejected by operator' }
        : { rejectionReason: null };
    const record = await this.prisma.kycRecord.update({
      where: { id: recordId },
      data: {
        state: next,
        panEnc: data.panEnc ?? undefined,
        panMasked: data.panMasked ?? undefined,
        digilockerDocId: data.digilockerDocId ?? undefined,
        aadhaarEsignRef: data.aadhaarEsignRef ?? undefined,
        videoKycRef: data.videoKycRef ?? undefined,
        videoKycScheduledAt: data.videoKycScheduledAt ?? undefined,
        ...rejectionFields,
        events: {
          create: {
            kind: 'STATE_TRANSITION',
            fromState: current,
            toState: next,
            meta: data as Record<string, unknown>,
          },
        },
      },
    });
    return snapshot(record);
  }

  private toResponse(record: PrismaKycRecord): KycStateResponse {
    return {
      userId: record.userId,
      state: record.state,
      panMasked: record.panMasked,
      rejectionReason: record.rejectionReason,
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}

/** Maps Prisma row → stable snapshot (decouples $Enums identities from app code). */
function snapshot(record: { id: string; userId: string; state: string; panMasked: string | null; rejectionReason: string | null; updatedAt: Date }): PrismaKycRecord {
  return {
    id: record.id,
    userId: record.userId,
    state: record.state as KycState,
    panMasked: record.panMasked,
    rejectionReason: record.rejectionReason,
    updatedAt: new Date(record.updatedAt.getTime()),
  };
}

