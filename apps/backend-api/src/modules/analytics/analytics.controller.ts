import { Controller, Get } from '@nestjs/common';
import {
  type AdvisorAnalyticsDto,
  type JwtPayload,
  UserRole,
} from '@wealthos/shared-types';
import { CurrentUser } from '../../core/current-user.decorator';
import { Roles } from '../../core/roles.decorator';
import { type AnalyticsService } from './analytics.service';

@Controller('analytics')
@Roles(UserRole.ADVISOR, UserRole.ADMIN)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** @param me advisor/admin principal. */
  @Get('advisor')
  async advisor(@CurrentUser() me: JwtPayload): Promise<AdvisorAnalyticsDto> {
    return this.analytics.advisor({ id: me.sub, role: me.role });
  }
}
