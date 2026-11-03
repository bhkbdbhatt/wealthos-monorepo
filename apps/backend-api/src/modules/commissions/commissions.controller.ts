import { Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { UserRole, type CommissionDto } from '@wealthos/shared-types';
import { type JwtPayload } from '@wealthos/shared-types';
import { CurrentUser } from '../../core/current-user.decorator';
import { Roles } from '../../core/roles.decorator';
import { CommissionsService } from './commissions.service';

export class CommissionsQuery {
  month?: string;
  advisorId?: string;
}

@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissions: CommissionsService) {}

  /**
   * @param me principal
   * @param query optional month (yyyy-MM) + admin advisor scope
   */
  @Get()
  async list(@CurrentUser() me: JwtPayload, query: CommissionsQuery): Promise<CommissionDto[]> {
    assertRole(me);
    return this.commissions.listForAdvisor({ id: me.sub, role: me.role }, query.advisorId, query.month);
  }

  /** @param me principal — latest trail month MRR */
  @Get('mrr')
  async mrr(@CurrentUser() me: JwtPayload): Promise<{ month: string; mrrPaise: number }> {
    assertRole(me);
    return this.commissions.mrrLatestMonth({ id: me.sub, role: me.role });
  }

  /** Force a trail pass (admin cron trigger; idempotent per month). */
  @Post('run-trail/:month')
  @Roles(UserRole.ADMIN)
  async runTrail(@Param('month') month: string): Promise<{ written: number }> {
    return { written: await this.commissions.runMonthlyTrail(month) };
  }
}

function assertRole(me: JwtPayload): void {
  if (me.role !== UserRole.ADVISOR && me.role !== UserRole.ADMIN) {
    throw new ForbiddenException('Commissions are advisor/admin only');
  }
}

export type AdvisoryQueryLookup = CommissionsQuery extends never ? never : never;
