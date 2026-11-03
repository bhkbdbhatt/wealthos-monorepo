import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@wealthos/database';
import {
  UserRole,
  type CommissionDto,
  type CommissionKind,
  type AdvisorTier,
} from '@wealthos/shared-types';
import { computeCommission } from '../../domain/commission-math';

interface TrailInput {
  advisorId: string;
  advisorTier: string;
  clientId: string;
  clientEmail: string;
  currentValuePaise: number;
  dominantAssetType: string;
}

/**
 * Commission engine (spec Key Algorithms):
 *  - Upfront: computed synchronously with each BUY transaction.
 *  - Trail: recomputed monthly by the trail cron from current holdings.
 * All amounts integer paise (floor), persisted with idempotent period keys.
 */
@Injectable()
export class CommissionsService {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upserts the upfront row for one BUY transaction (owned by its periodKey).
   * @param transactionId executed BUY/SIP transaction id
   */
  async recordUpfront(transactionId: string): Promise<CommissionDto | null> {
    const txn = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        asset: { select: { type: true } },
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            advisorId: true,
            advisor: { select: { id: true, tier: true } },
          },
        },
      },
    });
    if (!txn) return null;
    if (txn.type !== 'BUY' && txn.type !== 'SIP') return null;
    const advisorId = txn.user.advisorId ?? null;
    if (!advisorId) {
      this.logger.warn(`No advisor bound to client ${txn.userId}; skipping upfront`);
      return null;
    }
    const tier = (await this.prisma.user.findUnique({ where: { id: advisorId }, select: { tier: true } }))?.tier ?? 'BRONZE';
    const calc = computeCommission(
      'UPFRONT' as CommissionKind,
      txn.asset.type as Parameters<typeof computeCommission>[1],
      tier as AdvisorTier,
      txn.amountPaise,
    );
    const row = await this.prisma.commission.upsert({
      where: { advisorId_periodKey: { advisorId, periodKey: `T:${txn.id}` } },
      create: {
        advisorId,
        clientId: txn.userId,
        transactionId: txn.id,
        assetType: txn.asset.type,
        kind: 'UPFRONT',
        rateBps: calc.rateBps,
        amountPaise: calc.amountPaise,
        periodKey: `T:${txn.id}`,
      },
      update: { amountPaise: calc.amountPaise, rateBps: calc.rateBps },
      include: { advisor: { select: { email: true } } },
    });
    return this.toDto(row);
  }

  /**
   * Monthly trail pass: one row per (advisor, client, month), amount =
   * Î£ holding value Ã— trail rate / 12 in paise (floor).
   * @param monthIso "yyyy-MM" to process
   * @returns count of trail rows written
   */
  async runMonthlyTrail(monthIso: string): Promise<number> {
    if (!/^\d{4}-\d{2}$/.test(monthIso)) throw new Error('month must be yyyy-MM');
    const advisors = await this.prisma.user.findMany({
      where: { role: 'ADVISOR' },
      select: { id: true, tier: true },
    });
    let written = 0;
    for (const advisor of advisors) {
      const clients = await this.prisma.user.findMany({
        where: { advisorId: advisor.id },
        select: { id: true, email: true },
      });
      if (clients.length === 0) continue;
      const holdings = await this.prisma.portfolio.findMany({
        where: { userId: { in: clients.map((c) => c.id) }, units: { gt: 0 } },
        include: { asset: { select: { id: true, type: true, navPaise: true } } },
      });
      if (holdings.length === 0) continue;
      const perClient = new Map<string, { value: number; types: Map<string, number> }>();
      for (const h of holdings) {
        const value = Math.round(Number(h.units) * h.asset.navPaise);
        const bucket = perClient.get(h.userId) ?? { value: 0, types: new Map<string, number>() };
        bucket.value += value;
        bucket.types.set(h.asset.type, (bucket.types.get(h.asset.type) ?? 0) + value);
        perClient.set(h.userId, bucket);
      }
      for (const [clientId, bucket] of perClient.entries()) {
        const dominant = [...bucket.types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'MUTUAL_FUND';
        const calc = computeCommission(
          'TRAIL' as CommissionKind,
          dominant as Parameters<typeof computeCommission>[1],
          advisor.tier as AdvisorTier,
          bucket.value,
          monthIso,
        );
        if (calc.amountPaise <= 0) continue;
        await this.prisma.commission.upsert({
          where: { advisorId_periodKey: { advisorId: advisor.id, periodKey: `M:${monthIso}@${clientId}` } },
          create: {
            advisorId: advisor.id,
            clientId,
            transactionId: null,
            assetType: dominant as Parameters<typeof computeCommission>[1],
            kind: 'TRAIL',
            rateBps: calc.rateBps,
            amountPaise: calc.amountPaise,
            periodKey: `M:${monthIso}@${clientId}`,
          },
          update: { amountPaise: calc.amountPaise, rateBps: calc.rateBps },
        });
        written++;
      }
    }
    return written;
  }

  /**
   * Advisor commission history (own or admin-another).
   * @param me principal
   * @param advisorId scope (admin may pass other)
   * @param monthIso optional filter
   */
  async listForAdvisor(me: { id: string; role: UserRole }, advisorId?: string, monthIso?: string): Promise<CommissionDto[]> {
    const scope = this.scopeAdvisor(me, advisorId);
    const rows = await this.prisma.commission.findMany({
      where: {
        advisorId: scope,
        ...(monthIso ? { OR: [{ periodKey: { startsWith: `M:${monthIso}` } }, { kind: 'UPFRONT' }] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    });
    return rows.map((r) => this.toDto(r));
  }

  /** MRR = Î£ trailing credits for latest month â€” dashboard metric. */
  async mrrLatestMonth(me: { id: string; role: UserRole }): Promise<{ month: string; mrrPaise: number }> {
    const scope = this.scopeAdvisor(me, undefined);
    const latest = await this.prisma.commission.findFirst({
      where: { advisorId: scope, kind: 'TRAIL' },
      orderBy: [{ periodKey: 'desc' }],
      select: { periodKey: true },
    });
    const month = latest?.periodKey?.slice(2, 9) ?? new Date().toISOString().slice(0, 7);
    const rows = await this.prisma.commission.findMany({
      where: { advisorId: scope, kind: 'TRAIL', periodKey: { startsWith: `M:${month}` } },
      select: { amountPaise: true },
    });
    return { month, mrrPaise: rows.reduce((s, r) => s + r.amountPaise, 0) };
  }

  private scopeAdvisor(me: { id: string; role: UserRole }, advisorId?: string): string {
    if (me.role === UserRole.ADMIN) return advisorId ?? me.id;
    if (advisorId && advisorId !== me.id) {
      throw new Error('Adv_isors may only read their own ledger');
    }
    return me.id;
  }

  private toDto(row: {
    id: string;
    advisorId: string;
    clientId: string;
    transactionId: string | null;
    assetType: string;
    kind: string;
    rateBps: number;
    amountPaise: number;
    periodKey: string;
    createdAt: Date;
  }): CommissionDto {
    return {
      id: row.id,
      advisorId: row.advisorId,
      clientId: row.clientId,
      transactionId: row.transactionId,
      assetType: row.assetType as CommissionDto['assetType'],
      kind: row.kind as CommissionKind,
      rateBps: row.rateBps,
      amountPaise: row.amountPaise,
      periodMonth: row.periodKey.startsWith('M:') ? row.periodKey.slice(2, 9) : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Exposed for unit tests + cron re-use (pure projection of trail inputs). */
  static trailInputsSummary(inputs: TrailInput[]): number {
    return inputs.reduce((s, i) => s + i.currentValuePaise, 0);
  }
}
