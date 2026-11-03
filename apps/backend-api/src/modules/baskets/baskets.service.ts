import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type PrismaService } from '@wealthos/database';
import {
  TransactionType,
  UserRole,
  type BasketDto,
  type TransactionDto,
} from '@wealthos/shared-types';
import { type UsersService } from '../users/users.service';
import { type TransactionsService } from '../transactions/transactions.service';

interface BasketRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  riskLevel: string;
  items: Array<{
    targetWeightPct: number;
    asset: { id: string; slug: string; name: string; type: string };
  }>;
}

/**
 * Wealth Baskets (Module C2): a basket is a single purchase item that fans out
 * into weighted BUY executions. Weight rounding is assigned to the last leg so
 * the sum of legs always equals the requested amount exactly.
 */
@Injectable()
export class BasketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly transactions: TransactionsService,
  ) {}

  /** @returns every basket with its constituent funds. */
  async list(): Promise<BasketDto[]> {
    const baskets = await this.prisma.basket.findMany({
      include: { items: { include: { asset: true }, orderBy: { targetWeightPct: 'desc' } } },
      orderBy: { name: 'asc' },
    });
    return baskets.map((basket) => this.toDto(basket));
  }

  /** @param slug basket slug */
  async detail(slug: string): Promise<BasketDto> {
    const basket = await this.prisma.basket.findUnique({
      where: { slug },
      include: { items: { include: { asset: true }, orderBy: { targetWeightPct: 'desc' } } },
    });
    if (!basket) throw new NotFoundException('Basket not found');
    return this.toDto(basket);
  }

  /**
   * Fan-out purchase: one transaction row per basket constituent.
   * @param me caller principal
   * @param slug basket slug
   * @param input amount + idempotency key
   */
  async buy(
    me: { id: string; role: UserRole },
    slug: string,
    input: { amountPaise: number; idempotencyKey: string; targetUserId?: string },
  ): Promise<{ basketSlug: string; transactions: TransactionDto[] }> {
    const basket = await this.prisma.basket.findUnique({
      where: { slug },
      include: { items: { include: { asset: true }, orderBy: { targetWeightPct: 'desc' } } },
    });
    if (!basket) throw new NotFoundException('Basket not found');
    if (basket.items.length === 0) throw new BadRequestException('Basket has no constituents');
    const totalWeight = basket.items.reduce((sum, item) => sum + item.targetWeightPct, 0);
    if (totalWeight !== 100) {
      throw new BadRequestException(`Basket weights must total 100 (got ${totalWeight})`);
    }
    const owner = await this.resolveOwner(me, input.targetUserId);
    const legs: Array<{ assetSlug: string; amountPaise: number }> = [];
    let allocated = 0;
    basket.items.forEach((item, index) => {
      const isLast = index === basket.items.length - 1;
      const amountPaise = isLast
        ? input.amountPaise - allocated
        : Math.floor((input.amountPaise * item.targetWeightPct) / 100);
      allocated += amountPaise;
      if (amountPaise > 0) legs.push({ assetSlug: item.asset.slug, amountPaise });
    });
    if (legs.some((leg) => leg.amountPaise <= 0)) {
      throw new BadRequestException('Amount is too small for this basket weight split');
    }
    const transactions: TransactionDto[] = [];
    for (const leg of legs) {
      transactions.push(
        await this.transactions.execute(me.id, me.role, {
          assetSlug: leg.assetSlug,
          type: TransactionType.BUY,
          amountPaise: leg.amountPaise,
          idempotencyKey: `${input.idempotencyKey}:${leg.assetSlug}`,
          targetUserId: owner,
        }),
      );
    }
    return { basketSlug: basket.slug, transactions };
  }

  private async resolveOwner(
    me: { id: string; role: UserRole },
    targetUserId?: string,
  ): Promise<string> {
    if (!targetUserId || targetUserId === me.id) return me.id;
    if (me.role === UserRole.CLIENT) throw new ForbiddenException('Clients buy for themselves');
    if (me.role === UserRole.ADVISOR) {
      const advised = await this.users.advisedClientIds(me.id);
      if (!advised.includes(targetUserId)) throw new ForbiddenException('Not an advised client');
    }
    return targetUserId;
  }

  private toDto(basket: BasketRow): BasketDto {
    return {
      id: basket.id,
      slug: basket.slug,
      name: basket.name,
      description: basket.description,
      category: basket.category,
      riskLevel: basket.riskLevel as BasketDto['riskLevel'],
      items: basket.items.map((item) => ({
        asset: {
          id: item.asset.id,
          slug: item.asset.slug,
          name: item.asset.name,
          type: item.asset.type as BasketDto['items'][number]['asset']['type'],
        },
        targetWeightPct: item.targetWeightPct,
      })),
    };
  }
}
