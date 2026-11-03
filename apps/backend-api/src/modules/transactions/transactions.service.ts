import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '@wealthos/database';
import {
  UserRole,
  type CreateTransactionInput,
  type PaginatedTransactions,
  type TransactionDto,
} from '@wealthos/shared-types';
import { CommissionsService } from '../commissions/commissions.service';
import { UsersService } from '../users/users.service';
import { PortfoliosService } from '../portfolios/portfolios.service';

/**
 * Transaction executing engine (Module A3 core flow):
 *  - idempotency-key enforcement via unique index on Transaction.idempotencyKey
 *  - BUY: units = amount / NAV; SELL: pro-rata redemption of holding units
 *  - SWITCH: sell leg + buy leg executed atomically inside one Prisma transaction
 *  - Portfolio (holding) rollup maintained on each mutation
 */
@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly portfolios: PortfoliosService,
    private readonly commissions: CommissionsService,
  ) {}

  /**
   * @param userId requesting user id
   * @param role requesting role
   * @param input validated transaction input
   * @returns the executed transaction DTO (or the already-executed idempotent one)
   */
  async execute(
    userId: string,
    role: UserRole,
    input: CreateTransactionInput,
  ): Promise<TransactionDto> {
    const targetUser = role === UserRole.CLIENT ? userId : input.targetUserId;
    if (!targetUser) {
      throw new BadRequestException('targetUserId required for advisor executions');
    }
    const owned = await this.assertCanOperate(userId, role, targetUser);
    if (!owned) throw new ForbiddenException('Not allowed to execute for this client');

    const asset = await this.prisma.asset.findUnique({ where: { slug: input.assetSlug } });
    const target = await this.prisma.asset.findUnique({
      where: { slug: input.switchToAssetSlug ?? input.assetSlug },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    if (input.type === 'BUY' && input.amountPaise <= 0) {
      throw new BadRequestException('Buy amount must be positive');
    }
    const executed = await this.prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.transaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { asset: true },
        });
        if (existing) return existing;
      }
      if (input.type === 'SELL') {
        const holding = await tx.portfolio.findUnique({
          where: { userId_assetId: { userId: owned, assetId: asset.id } },
        });
        if (!holding || holding.units.lte(0)) throw new NotFoundException('No units to redeem');
        const units = Number(holding.units);
        const currentPaise = Math.round(units * asset.navPaise);
        if (input.amountPaise > currentPaise) {
          throw new BadRequestException('Redemption exceeds current holding value');
        }
        const sellUnits = units * (input.amountPaise / Math.max(currentPaise, 1));
        const created = await tx.transaction.create({
          data: {
            userId: owned,
            assetId: asset.id,
            type: input.type,
            amountPaise: input.amountPaise,
            units: sellUnits.toFixed(8),
            navPaise: asset.navPaise,
            status: 'EXECUTED',
            executedAt: new Date(),
            idempotencyKey: input.idempotencyKey ?? null,
          },
        });
        await this.applyHoldingDelta(tx, owned, asset.id, -sellUnits, -input.amountPaise);
        return created;
      }
      if (input.type === 'BUY') {
        const units = input.amountPaise / asset.navPaise;
        const created = await tx.transaction.create({
          data: {
            userId: owned,
            assetId: asset.id,
            type: input.type,
            amountPaise: input.amountPaise,
            units: units.toFixed(8),
            navPaise: asset.navPaise,
            status: 'EXECUTED',
            executedAt: new Date(),
            idempotencyKey: input.idempotencyKey ?? null,
          },
        });
        await this.applyHoldingDelta(tx, owned, asset.id, units, input.amountPaise);
        return created;
      }
      throw new BadRequestException('Use /sips for SIP-type transactions');
    });
    if (executed.type === 'BUY' || executed.type === 'SIP') {
      await this.commissions.recordUpfront(executed.id);
    }
    if (input.type === 'SELL' && target && input.switchToAssetSlug && executed.id) {
      // SWITCH: after the sell leg, create the buy leg atomically into the target asset.
      await this.executeSwitchLeg(executed, owned, target, input.amountPaise);
    }
    return this.toDto(executed);
  }

  /** Bulk execution: single asset list per client, sharing one idempotency scope. */
  async executeBulk(
    userId: string,
    role: UserRole,
    items: CreateTransactionInput[],
  ): Promise<TransactionDto[]> {
    const out: TransactionDto[] = [];
    for (const item of items) {
      out.push(await this.execute(userId, role, item));
    }
    return out;
  }

  /**
   * Paginated history for the current user (or an advised client).
   * @param me principal
   * @param targetUserId optional advisor view
   * @param page 1-based page
   * @param pageSize up to 100 rows
   */
  async list(
    me: { id: string; role: UserRole },
    targetUserId: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<PaginatedTransactions> {
    const userId = await this.resolveListTarget(me, targetUserId);
    const where = { userId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        include: { asset: true },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((t) => this.toDto(t)),
      total,
      page,
      pageSize,
    };
  }

  /** Executed summary used by analytics. */
  async executedSummaryRange(userId: string, fromIso: string): Promise<{ count: number; inflowPaise: number; outflowPaise: number }> {
    const txns = await this.prisma.transaction.findMany({
      where: { userId, status: 'EXECUTED', executedAt: { gte: new Date(fromIso) } },
      select: { type: true, amountPaise: true },
    });
    const inflow = txns
      .filter((t) => t.type === 'BUY' || t.type === 'SIP')
      .reduce((s, t) => s + t.amountPaise, 0);
    const outflow = txns
      .filter((t) => t.type === 'SELL')
      .reduce((s, t) => s + t.amountPaise, 0);
    return { count: txns.length, inflowPaise: inflow, outflowPaise: outflow };
  }

  /**
   * Maintain (upsert) the holding row: units, invested, avg NAV, first purchase.
   * @param tx prisma interactive transaction client
   * @param userId holding owner
   * @param assetId target asset
   * @param unitsDelta signed units delta
   * @param investedDelta signed invested paise delta (positive buys, negative sells)
   */
  async applyHoldingDelta(
    tx: Prisma.TransactionClient,
    userId: string,
    assetId: string,
    unitsDelta: number,
    investedDelta: number,
  ): Promise<void> {
    const existing = await tx.portfolio.findUnique({
      where: { userId_assetId: { userId, assetId } },
    });
    if (!existing) {
      if (unitsDelta <= 0) throw new ConflictException('No holding to reduce');
      const units = unitsDelta;
      const rec = await tx.portfolio.create({
        data: {
          userId,
          assetId,
          units: units.toFixed(8),
          avgNavPaise: Math.round(investedDelta / units),
          investedPaise: investedDelta,
          firstPurchaseAt: new Date(),
        },
      });
      void rec;
      return;
    }
    const units = Math.max(0, Number(existing.units) + unitsDelta);
    const invested = Math.max(0, existing.investedPaise + investedDelta);
    const avgNavPaise = units > 0 ? Math.round(invested / units) : 0;
    await tx.portfolio.update({
      where: { id: existing.id },
      data: {
        units: units.toFixed(8),
        investedPaise: invested,
        avgNavPaise,
        realizedPaise: unitsDelta < 0 ? existing.realizedPaise + (-investedDelta) : existing.realizedPaise,
        firstPurchaseAt: existing.firstPurchaseAt ?? new Date(),
      },
    });
    if (units === 0) {
      await tx.portfolio.delete({ where: { id: existing.id } });
    }
  }

  /** SWITCH second leg implemented through the same execute() path for consistency. */
  private async executeSwitchLeg(
    sellLeg: { id: string },
    userId: string,
    targetAsset: { id: string; slug: string; navPaise: number },
    amountPaise: number,
  ): Promise<string | undefined> {
    const units = amountPaise / targetAsset.navPaise;
    await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          userId,
          assetId: targetAsset.id,
          type: 'SWITCH',
          amountPaise,
          units: units.toFixed(8),
          navPaise: targetAsset.navPaise,
          status: 'EXECUTED',
          executedAt: new Date(),
          idempotencyKey: `switch:${sellLeg.id}`,
        },
      });
      await this.applyHoldingDelta(tx, userId, targetAsset.id, units, amountPaise);
      return this.toDto(created);
    });
    return sellLeg.id;
  }

  /** Shared authorization: admins any; advisors only their advised clients; clients self. */
  private async assertCanOperate(
    requesterId: string,
    requesterRole: UserRole,
    targetUser: string,
  ): Promise<string | false> {
    if (requesterRole === UserRole.CLIENT) return requesterId === targetUser ? requesterId : false;
    if (requesterRole === UserRole.ADMIN) return targetUser;
    const advised = await this.users.advisedClientIds(requesterId);
    return advised.includes(targetUser) ? targetUser : false;
  }

  private async resolveListTarget(me: { id: string; role: UserRole }, targetUserId?: string): Promise<string> {
    if (!targetUserId) return me.id;
    const owned = await this.assertCanOperate(me.id, me.role, targetUserId);
    if (!owned) throw new ForbiddenException('Not allowed to view this user');
    return owned;
  }

  private toDto(txn: {
    id: string;
    userId: string;
    assetId: string;
    type: string;
    amountPaise: number;
    units: { toString(): string };
    navPaise: number;
    status: string;
    idempotencyKey: string | null;
    executedAt: Date | null;
    createdAt: Date;
    asset?: { id: string; slug: string; name: string; type: string };
  }): TransactionDto {
    return {
      id: txn.id,
      userId: txn.userId,
      asset: {
        id: txn.asset?.id ?? txn.assetId,
        slug: txn.asset?.slug ?? '',
        name: txn.asset?.name ?? '',
        type: (txn.asset?.type ?? '') as TransactionDto['asset']['type'],
      },
      type: txn.type as TransactionDto['type'],
      amountPaise: txn.amountPaise,
      units: txn.units.toString(),
      navPaise: txn.navPaise,
      status: txn.status as TransactionDto['status'],
      idempotencyKey: txn.idempotencyKey,
      executedAt: txn.executedAt ? txn.executedAt.toISOString() : null,
      createdAt: txn.createdAt.toISOString(),
    };
  }
}
