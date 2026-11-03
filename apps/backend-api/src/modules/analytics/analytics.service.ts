import { ForbiddenException, Injectable } from '@nestjs/common';
import { type PrismaService } from '@wealthos/database';
import {
  type AssetType,
  UserRole,
  type AdvisorAnalyticsDto,
  type AnalyticsTimePoint,
} from '@wealthos/shared-types';

interface MonthBucket {
  label: string;
  end: Date;
}

/**
 * Advisor dashboard analytics (Module B1): AUM, live SIPs, MRR, commissions,
 * a 12-month timeseries and asset-class allocation. All figures are integers
 * in paise and scoped to the advisor's own clients.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param me advisor/admin principal
   * @returns advisor dashboard aggregate snapshot
   */
  async advisor(me: { id: string; role: UserRole }): Promise<AdvisorAnalyticsDto> {
    if (me.role !== UserRole.ADVISOR && me.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Advisor analytics only');
    }
    const clientWhere =
      me.role === UserRole.ADMIN ? { role: 'CLIENT' as const } : { role: 'CLIENT' as const, advisorId: me.id };
    const clients = await this.prisma.user.findMany({
      where: clientWhere,
      select: { id: true },
    });
    const clientIds = clients.map((client) => client.id);

    const [holdings, activeSips, upfront, trail, transactions] = await Promise.all([
      this.prisma.portfolio.findMany({
        where: { userId: { in: clientIds }, units: { gt: 0 } },
        include: { asset: { select: { navPaise: true, type: true } } },
      }),
      this.prisma.sip.findMany({
        where: { userId: { in: clientIds }, status: 'ACTIVE' },
        select: { monthlyAmountPaise: true },
      }),
      this.prisma.commission.aggregate({
        where: { ...(me.role === UserRole.ADVISOR ? { advisorId: me.id } : {}), kind: 'UPFRONT' },
        _sum: { amountPaise: true },
      }),
      this.prisma.commission.aggregate({
        where: { ...(me.role === UserRole.ADVISOR ? { advisorId: me.id } : {}), kind: 'TRAIL' },
        _sum: { amountPaise: true },
      }),
      this.prisma.transaction.findMany({
        where: { userId: { in: clientIds }, status: 'EXECUTED' },
        select: {
          type: true,
          units: true,
          amountPaise: true,
          executedAt: true,
          createdAt: true,
          asset: { select: { navPaise: true, id: true } },
        },
        orderBy: [{ executedAt: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    const byType = new Map<AssetType, number>();
    let aumTotalPaise = 0;
    for (const holding of holdings) {
      const value = Math.round(Number(holding.units) * holding.asset.navPaise);
      aumTotalPaise += value;
      byType.set(holding.asset.type as AssetType, (byType.get(holding.asset.type as AssetType) ?? 0) + value);
    }

    return {
      aumTotalPaise,
      liveSipCount: activeSips.length,
      mrrPaise: activeSips.reduce((sum, sip) => sum + sip.monthlyAmountPaise, 0),
      clientCount: clientIds.length,
      commissionsUpfrontPaise: upfront._sum.amountPaise ?? 0,
      commissionsTrailPaise: trail._sum.amountPaise ?? 0,
      timeseries: buildTimeseries(transactions),
      byAssetClass: [...byType.entries()]
        .map(([type, currentPaise]) => ({ type, currentPaise }))
        .sort((a, b) => b.currentPaise - a.currentPaise),
    };
  }
}

function buildTimeseries(
  transactions: Array<{
    type: string;
    units: unknown;
    amountPaise: number;
    executedAt: Date | null;
    createdAt: Date;
    asset: { navPaise: number; id: string };
  }>,
): AnalyticsTimePoint[] {
  const buckets = lastMonths(12);
  const unitsByAsset = new Map<string, number>();
  const navByAsset = new Map<string, number>();
  for (const txn of transactions) navByAsset.set(txn.asset.id, txn.asset.navPaise);

  let cursor = 0;
  const points: AnalyticsTimePoint[] = [];
  for (let index = 0; index < buckets.length; index++) {
    const bucket = buckets[index];
    const previousEnd = index === 0 ? null : buckets[index - 1].end;
    let inflow = 0;
    let outflow = 0;
    while (cursor < transactions.length) {
      const txn = transactions[cursor];
      const when = txn.executedAt ?? txn.createdAt;
      if (when > bucket.end) break;
      applyUnits(unitsByAsset, txn);
      cursor++;
    }
    const windowStart = previousEnd ?? new Date(0);
    for (const txn of transactions) {
      const when = txn.executedAt ?? txn.createdAt;
      if (when <= windowStart || when > bucket.end) continue;
      if (txn.type === 'BUY' || txn.type === 'SIP') inflow += txn.amountPaise;
      else if (txn.type === 'SELL') outflow += txn.amountPaise;
    }
    let aumPaise = 0;
    for (const [assetId, units] of unitsByAsset) {
      aumPaise += Math.round(units * (navByAsset.get(assetId) ?? 0));
    }
    points.push({
      date: bucket.label,
      aumPaise,
      sipInflowPaise: inflow,
      sipOutflowPaise: outflow,
    });
  }
  return points;
}

function applyUnits(
  unitsByAsset: Map<string, number>,
  txn: { type: string; units: unknown; asset: { id: string } },
): void {
  const current = unitsByAsset.get(txn.asset.id) ?? 0;
  const delta = Math.abs(Number(txn.units));
  if (txn.type === 'BUY' || txn.type === 'SIP' || txn.type === 'SWITCH') {
    unitsByAsset.set(txn.asset.id, current + delta);
  } else {
    unitsByAsset.set(txn.asset.id, Math.max(0, current - delta));
  }
}

function lastMonths(count: number): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const now = new Date();
  for (let offset = count - 1; offset >= 0; offset--) {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset + 1, 0, 23, 59, 59, 999));
    buckets.push({ label: end.toISOString().slice(0, 10), end });
  }
  return buckets;
}
