import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import pdfParse from 'pdf-parse';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '@wealthos/database';
import {
  UserRole,
  type CasUploadDto,
  type CasParserVersion,
  type TransactionType,
} from '@wealthos/shared-types';
import {
  casTextToResult,
  casTxnFingerprint,
  type ParsedCasTransaction,
} from '../../domain/cas-parser';
import { UsersService } from '../users/users.service';

export interface CasPdfFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface CasUploadSummary {
  upload: CasUploadDto;
  imported: number;
  duplicatesSkipped: number;
  skippedLines: number;
}

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * CAS tracker + parser engine (Module A4). The PDF text extraction lives here;
 * parsing and fingerprinting live in the pure domain layer so they are testable.
 * Re-uploads are deduplicated by the transaction-level idempotency key.
 */
@Injectable()
export class CasService {
  private readonly logger = new Logger(CasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  /**
   * @param me caller principal
   * @param file uploaded PDF (CAMS or Karvy layout)
   * @param targetUserId optional advisor-scoped client
   */
  async upload(
    me: { id: string; role: UserRole },
    file: CasPdfFile | undefined,
    targetUserId?: string,
  ): Promise<CasUploadSummary> {
    if (!file) throw new BadRequestException('A CAS PDF is required');
    if (file.size > MAX_BYTES) throw new BadRequestException('CAS PDF exceeds 12 MB limit');
    if (!file.originalname.toLowerCase().endsWith('.pdf') && file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF CAS statements are supported');
    }
    const owner = await this.resolveOwner(me, targetUserId);
    const parserVersion: CasParserVersion = detectParserVersion(file.buffer);
    const created = await this.prisma.casUpload.create({
      data: {
        userId: owner,
        fileName: file.originalname,
        sizeBytes: file.size,
        parserVersion,
        status: 'PROCESSING',
      },
    });

    let text: string;
    try {
      const parsed = await pdfParse(file.buffer);
      text = parsed.text ?? '';
    } catch {
      return this.fail(created.id, owner, 'Could not extract text from the supplied PDF');
    }
    if (text.trim().length === 0) {
      return this.fail(created.id, owner, 'PDF contains no extractable text (scanned statement?)');
    }

    const parsedResult = casTextToResult(text);
    if (parsedResult.transactions.length === 0) {
      return this.fail(
        created.id,
        owner,
        `No CAS transactions recognised (${parsedResult.skippedLines.length} lines skipped)`,
      );
    }

    const sorted = [...parsedResult.transactions].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
    const assetIds = new Set<string>();
    let imported = 0;
    let duplicatesSkipped = 0;
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const parsedTxn of sorted) {
          const asset = await this.resolveAsset(tx, parsedTxn);
          assetIds.add(asset.id);
          const outcome = await this.importTransaction(tx, owner, asset.id, parsedTxn);
          if (outcome === 'IMPORTED') imported++;
          else duplicatesSkipped++;
        }
        for (const assetId of assetIds) {
          await this.rebuildHolding(tx, owner, assetId);
        }
      });
    } catch (error) {
      this.logger.error(
        `CAS import failed for upload ${created.id}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return this.fail(created.id, owner, 'Import failed while writing transactions');
    }

    const status =
      duplicatesSkipped === 0 ? 'SUCCESS' : imported === 0 ? 'PARTIAL' : 'PARTIAL';
    const updated = await this.prisma.casUpload.update({
      where: { id: created.id },
      data: {
        status,
        transactionsImported: imported,
        duplicatesSkipped,
        errorDetails:
          parsedResult.skippedLines.length > 0
            ? ({ skippedLines: parsedResult.skippedLines.length } as Prisma.InputJsonValue)
            : undefined,
      },
    });
    return {
      upload: toCasDto(updated),
      imported,
      duplicatesSkipped,
      skippedLines: parsedResult.skippedLines.length,
    };
  }

  /** @param me caller principal @param targetUserId optional advisor scope. */
  async list(me: { id: string; role: UserRole }, targetUserId?: string): Promise<CasUploadDto[]> {
    const owner = await this.resolveOwner(me, targetUserId);
    const uploads = await this.prisma.casUpload.findMany({
      where: { userId: owner },
      orderBy: { createdAt: 'desc' },
    });
    return uploads.map(toCasDto);
  }

  /** @param me caller principal @param id upload id. */
  async detail(me: { id: string; role: UserRole }, id: string): Promise<CasUploadDto> {
    const upload = await this.prisma.casUpload.findUnique({ where: { id } });
    if (!upload) throw new NotFoundException('CAS upload not found');
    if (me.role === UserRole.CLIENT && upload.userId !== me.id) {
      throw new ForbiddenException('Not your CAS upload');
    }
    if (me.role === UserRole.ADVISOR) {
      const advised = await this.users.advisedClientIds(me.id);
      if (!advised.includes(upload.userId)) throw new ForbiddenException('Not an advised client');
    }
    return toCasDto(upload);
  }

  private async fail(
    uploadId: string,
    _owner: string,
    reason: string,
  ): Promise<CasUploadSummary> {
    const updated = await this.prisma.casUpload.update({
      where: { id: uploadId },
      data: {
        status: 'FAILED',
        errorDetails: { reason } as Prisma.InputJsonValue,
      },
    });
    return {
      upload: toCasDto(updated),
      imported: 0,
      duplicatesSkipped: 0,
      skippedLines: 0,
    };
  }

  private async resolveOwner(
    me: { id: string; role: UserRole },
    targetUserId?: string,
  ): Promise<string> {
    if (!targetUserId || targetUserId === me.id) return me.id;
    if (me.role === UserRole.CLIENT) throw new ForbiddenException('Clients upload their own CAS');
    if (me.role === UserRole.ADVISOR) {
      const advised = await this.users.advisedClientIds(me.id);
      if (!advised.includes(targetUserId)) throw new ForbiddenException('Not an advised client');
    }
    return targetUserId;
  }

  private async resolveAsset(
    tx: Prisma.TransactionClient,
    parsed: ParsedCasTransaction,
  ): Promise<{ id: string }> {
    if (parsed.schemeCode) {
      const byCode = await tx.asset.findUnique({ where: { schemeCode: parsed.schemeCode } });
      if (byCode) return byCode;
    }
    const byName = await tx.asset.findFirst({
      where: { name: { equals: parsed.fundName, mode: 'insensitive' } },
    });
    if (byName) return byName;
    const slug = await this.uniqueSlug(tx, slugify(parsed.fundName));
    const schemeCode =
      parsed.schemeCode ??
      `CAS-${createHash('sha256').update(parsed.fundName).digest('hex').slice(0, 10).toUpperCase()}`;
    const navPaise = Math.max(1, Math.round(parsed.nav * 100));
    const created = await tx.asset.create({
      data: {
        slug,
        name: parsed.fundName,
        type: 'MUTUAL_FUND',
        schemeCode,
        issuer: 'CAS Import',
        category: null,
        navPaise,
        navUpdatedAt: new Date(`${parsed.dateIso}T00:00:00.000Z`),
        navHistory: {
          create: { date: new Date(`${parsed.dateIso}T00:00:00.000Z`), navPaise },
        },
      },
    });
    return created;
  }

  private async importTransaction(
    tx: Prisma.TransactionClient,
    ownerId: string,
    assetId: string,
    parsed: ParsedCasTransaction,
  ): Promise<'IMPORTED' | 'DUPLICATE'> {
    const idempotencyKey = `cas:${ownerId}:${casTxnFingerprint(parsed)}`;
    const existing = await tx.transaction.findUnique({ where: { idempotencyKey } });
    if (existing) return 'DUPLICATE';
    const amountPaise = Math.max(1, Math.round(parsed.amount * 100));
    const navPaise = Math.max(1, Math.round(parsed.nav * 100));
    const units = Math.abs(parsed.units);
    await tx.transaction.create({
      data: {
        userId: ownerId,
        assetId,
        type: toTransactionType(parsed.kind),
        amountPaise,
        units: units.toFixed(8),
        navPaise,
        status: 'EXECUTED',
        executedAt: new Date(`${parsed.dateIso}T12:00:00.000Z`),
        idempotencyKey,
      },
    });
    return 'IMPORTED';
  }

  /**
   * Recompute the (user, asset) holding from every executed transaction after a
   * CAS import. Cost basis is reduced proportionally on redemptions so invested
   * value always reflects the remaining units.
   */
  private async rebuildHolding(
    tx: Prisma.TransactionClient,
    userId: string,
    assetId: string,
  ): Promise<void> {
    const transactions = await tx.transaction.findMany({
      where: { userId, assetId, status: 'EXECUTED' },
      orderBy: [{ executedAt: 'asc' }, { createdAt: 'asc' }],
    });
    let units = 0;
    let invested = 0;
    let realized = 0;
    let firstAt: Date | null = null;
    for (const txn of transactions) {
      const txnUnits = Math.abs(Number(txn.units));
      const isInflow = txn.type === 'BUY' || txn.type === 'SIP' || txn.type === 'SWITCH';
      if (isInflow) {
        units += txnUnits;
        invested += txn.amountPaise;
        firstAt = firstAt ?? txn.executedAt ?? txn.createdAt;
      } else {
        const avgCost = units > 0 ? invested / units : txn.navPaise;
        const soldUnits = Math.min(txnUnits, units);
        const costRemoved = Math.round(avgCost * soldUnits);
        units = Math.max(0, units - soldUnits);
        invested = Math.max(0, invested - costRemoved);
        realized += txn.amountPaise - costRemoved;
      }
    }
    const existing = await tx.portfolio.findUnique({
      where: { userId_assetId: { userId, assetId } },
    });
    if (units <= 0) {
      if (existing) await tx.portfolio.delete({ where: { id: existing.id } });
      return;
    }
    const data = {
      units: units.toFixed(8),
      avgNavPaise: Math.round(invested / units),
      investedPaise: invested,
      realizedPaise: realized,
      firstPurchaseAt: firstAt,
    };
    if (existing) {
      await tx.portfolio.update({ where: { id: existing.id }, data });
    } else {
      await tx.portfolio.create({ data: { userId, assetId, ...data } });
    }
  }

  private async uniqueSlug(tx: Prisma.TransactionClient, base: string): Promise<string> {
    let candidate = base || 'cas-imported-fund';
    let suffix = 1;
    while (await tx.asset.findUnique({ where: { slug: candidate } })) {
      candidate = `${base}-${suffix++}`;
      if (suffix > 1000) throw new BadRequestException('Could not allocate a unique fund slug');
    }
    return candidate;
  }
}

function toTransactionType(kind: ParsedCasTransaction['kind']): TransactionType {
  switch (kind) {
    case 'REDEMPTION':
      return 'SELL' as TransactionType;
    case 'SWITCH':
      return 'SWITCH' as TransactionType;
    case 'SIP':
      return 'SIP' as TransactionType;
    default:
      return 'BUY' as TransactionType;
  }
}

function detectParserVersion(buffer: Buffer): CasParserVersion {
  const head = buffer.subarray(0, Math.min(buffer.length, 200_000)).toString('latin1').toLowerCase();
  return head.includes('karvy') ? 'karvy-v1' : 'cams-v1';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function toCasDto(upload: {
  id: string;
  fileName: string;
  sizeBytes: number;
  parserVersion: string;
  status: string;
  transactionsImported: number;
  duplicatesSkipped: number;
  errorDetails: Prisma.JsonValue;
  createdAt: Date;
}): CasUploadDto {
  return {
    id: upload.id,
    fileName: upload.fileName,
    sizeBytes: upload.sizeBytes,
    parserVersion: upload.parserVersion as CasParserVersion,
    status: upload.status as CasUploadDto['status'],
    transactionsImported: upload.transactionsImported,
    duplicatesSkipped: upload.duplicatesSkipped,
    errorDetails: upload.errorDetails as CasUploadDto['errorDetails'],
    createdAt: upload.createdAt.toISOString(),
  };
}
