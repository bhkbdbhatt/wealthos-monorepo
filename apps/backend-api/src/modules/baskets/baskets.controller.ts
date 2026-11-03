import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  type BasketDto,
  type JwtPayload,
  type TransactionDto,
  UserRole,
} from '@wealthos/shared-types';
import { CurrentUser } from '../../core/current-user.decorator';
import { Roles } from '../../core/roles.decorator';
import { BuyBasketDto } from './baskets.dto';
import { BasketsService } from './baskets.service';

@Controller('baskets')
export class BasketsController {
  constructor(private readonly baskets: BasketsService) {}

  /** @returns all thematic baskets. */
  @Get()
  async list(): Promise<BasketDto[]> {
    return this.baskets.list();
  }

  /** @param slug basket slug. */
  @Get(':slug')
  async detail(@Param('slug') slug: string): Promise<BasketDto> {
    return this.baskets.detail(slug);
  }

  /** @param me principal; @param slug basket slug; @param dto amount + idempotency. */
  @Post(':slug/buy')
  @Roles(UserRole.CLIENT, UserRole.ADVISOR, UserRole.ADMIN)
  async buy(
    @CurrentUser() me: JwtPayload,
    @Param('slug') slug: string,
    @Body() dto: BuyBasketDto,
  ): Promise<{ basketSlug: string; transactions: TransactionDto[] }> {
    return this.baskets.buy({ id: me.sub, role: me.role }, slug, dto);
  }
}
