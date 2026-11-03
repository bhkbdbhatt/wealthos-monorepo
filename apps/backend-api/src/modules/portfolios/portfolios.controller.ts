import { Controller, Get, Query } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { UserRole, type PortfolioSummary } from '@wealthos/shared-types';
import { type JwtPayload } from '@wealthos/shared-types';
import { CurrentUser } from '../../core/current-user.decorator';
import { Roles } from '../../core/roles.decorator';
import { type PortfoliosService } from './portfolios.service';

export class PortfolioQuery {
  @IsOptional()
  @IsString()
  /** Advisor passing client id to view; CLIENTs pass nothing. */
  userId?: string;
}

@Controller('portfolios')
export class PortfoliosController {
  constructor(private readonly portfolios: PortfoliosService) {}

  /**
   * Unified portfolio viewer: current vs invested, XIRR, allocation slices.
   * @param me principal
   * @param query optional target user (advisor-scoped)
   */
  @Get()
  async summary(
    @CurrentUser() me: JwtPayload,
    @Query() query: PortfolioQuery,
  ): Promise<PortfolioSummary> {
    return this.portfolios.getPortfolio(me.sub, me.role, query.userId);
  }

  /** @param me advisor rollup */
  @Get('advisor-summary')
  @Roles(UserRole.ADVISOR, UserRole.ADMIN)
  async advisorSummary(
    @CurrentUser() me: JwtPayload,
  ): Promise<{ aumTotalPaise: number; clientCount: number }> {
    return this.portfolios.advisorAumSummary(me.sub);
  }
}
