import { Injectable, NotFoundException } from '@nestjs/common';
import { type PrismaService } from '@wealthos/database';
import {
  type AssetType,
  type HoldingDto,
  type PortfolioSummary,
  UserRole,
} from '@wealthos/shared-types';
import { allocationSlices, holdingCurrentPaise, aumTotals, clampPct } from '../../domain/aum';
import { xirr, type XirrFlow } from '../../domain/xirr';
import { type UsersService } from '../users/users.service';
/**
 * Unified portfolio viewer (Module C1/B1 feeding):
 *  - holdings with current value vs invested
 *  - allocation slices by asset class
 *  - XIRR over real cashflows with today's liquidation value as synthetic inflow
 */
@Injectable()
export class PortfoliosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  /**
   * Scope rules: CLIENT reads own; ADVISOR may read any advised client; ADMIN all.
   * @param requesterId principal id
   * @param requesterRole principal role
   * @param targetUserId portfolio owner (defaults: requester)
   */
  async getPortfolio(
    requesterId: string,
    requesterRole: UserRole,
    targetUserId?: string,
  ): Promise<PortfolioSummary> {
    const owner = await this.resolveOwner(requesterId, requesterRole, targetUserId);
    const holdings = await this.prisma.portfolio.findMany({
      where: { userId: owner },
      include: { asset: true },
      orderBy: [{ updatedAt: 'desc' }],
    });
    const rows = holdings
      .filter((h) => h.units.gt(0))
      .map((h) => ({
        holdingId: h.id,
        units: Number(h.units),
        investedPaise: h.investedPaise,
        assetType: h.asset.type as AssetType,
        assetId: h.asset.id,
        currentNavPaise: h.asset.navPaise,
      }));
    const totals = aumTotals(rows);
    const holdingDtos: HoldingDto[] = holdings
      .filter((h) => h.units.gt(0))
      .map((h) => {
        const current = holdingCurrentPaise({
          units: Number(h.units),
          investedPaise: h.investedPaise,
          assetId: h.assetId,
          assetType: h.asset.type as AssetType,
          currentNavPaise: h.asset.navPaise,
        });
        const gain = current - h.investedPaise;
        return {
          holdingId: h.id,
          asset: {
            id: h.asset.id,
            slug: h.asset.slug,
            name: h.asset.name,
            type: h.asset.type as AssetType,
            schemeCode: h.asset.schemeCode,
            issuer: h.asset.issuer,
            category: h.asset.category,
            navPaise: h.asset.navPaise,
            navUpdatedAt: h.asset.navUpdatedAt.toISOString(),
          },
          units: h.units.toFixed(8),
          investedPaise: h.investedPaise,
          currentPaise: current,
          gainPaise: gain,
          gainPct: h.investedPaise > 0 ? clampPct((gain / h.investedPaise) * 100) : 0,
          firstPurchaseAt: h.firstPurchaseAt ? h.firstPurchaseAt.toISOString() : null,
        };
      });
    const flows = await this.buildXirrFlows(owner, rows);
    const xirrValue = xirr(flows);
    return {
      userId: owner,
      holdings: holdingDtos,
      investedPaise: totals.investedPaise,
      currentPaise: totals.currentPaise,
      gainPaise: totals.gainPaise,
      gainPct: totals.gainPct,
      xirrPct: xirrValue === null ? null : Math.round(xirrValue * 10000) / 100,
      allocationByType: allocationSlices(rows),
    };
  }

  /** Advisor rollup: AUM across every advised client (used for the B1 dashboard). */
  async advisorAumSummary(advisorId: string): Promise<{
    aumTotalPaise: number;
    clientCount: number;
  }> {
    const clients = await this.prisma.user.findMany({
      where: { advisorId },
      select: { id: true },
    });
    const rows = await this.prisma.portfolio.findMany({
      where: { userId: { in: clients.map((c) => c.id) }, units: { gt: 0 } },
      include: { asset: true },
    });
    const totals = aumTotals(
      rows.map((h) => ({
        units: Number(h.units),
        investedPaise: h.investedPaise,
        assetId: h.assetId,
        assetType: h.asset.type as AssetType,
        currentNavPaise: h.asset.navPaise,
      })),
    );
    return { aumTotalPaise: totals.currentPaise, clientCount: clients.length };
  }

  /**
   * Ownership resolution centralised so ALL modules share it.
   * @param requesterId caller id
   * @param requesterRole caller role
   * @param targetUserId optional target
   */
  private async resolveOwner(
    requesterId: string,
    requesterRole: UserRole,
    targetUserId?: string,
  ): Promise<string> {
    if (!targetUserId || requesterRole === UserRole.CLIENT) return requesterId;
    if (requesterRole === UserRole.ADMIN) return targetUserId;
    const advised = await this.users.advisedClientIds(requesterId);
    if (!advised.includes(targetUserId)) {
      throw new NotFoundException('Client is not advised by you');
    }
    return targetUserId;
  }

  /** Cashflow stream: real BUY/SELL/SIP flows + synthetic liquidation of current units. */
  private async buildXirrFlows(
    owner: string,
    rows: Array<{ assetId: string; units: number; currentNavPaise: number }>,
  ): Promise<XirrFlow[]> {
    const txns = await this.prisma.transaction.findMany({
      where: { userId: owner, status: 'EXECUTED' },
      include: { asset: true },
      orderBy: { executedAt: 'asc' },
    });
    const flows: XirrFlow[] = txns.map((t) => ({
      date: (t.executedAt ?? t.createdAt).toISOString().slice(0, 10),
      amount: t.type === 'SELL' ? t.amountPaise : -Math.abs(t.amountPaise),
    }));
    const liquidationPaise = rows.reduce((s, r) => s + Math.round(r.units * r.currentNavPaise), 0);
    if (liquidationPaise > 0) {
      flows.push({
        date: new Date().toISOString().slice(0, 10),
        amount: liquidationPaise,
      });
    }
    return flows;
  }
}

