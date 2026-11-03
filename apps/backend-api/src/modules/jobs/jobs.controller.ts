import { Body, Controller, Post } from '@nestjs/common';
import { IsOptional, IsString, Matches } from 'class-validator';
import { UserRole } from '@wealthos/shared-types';
import { Roles } from '../../core/roles.decorator';
import { type JobsService, type NavRefreshResult, type SipCronResult } from './jobs.service';

export class RunSipCronDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  todayIso?: string;
}

export class RunTrailCronDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  monthIso?: string;
}

@Controller('jobs')
@Roles(UserRole.ADMIN)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  /** @param dto optional replay date. */
  @Post('sip/run')
  async runSip(@Body() dto: RunSipCronDto): Promise<SipCronResult> {
    return this.jobs.runDailySips(dto.todayIso);
  }

  /** @param dto optional month replay. */
  @Post('trail/run')
  async runTrail(@Body() dto: RunTrailCronDto): Promise<{ trailRowsWritten: number }> {
    return { trailRowsWritten: await this.jobs.runMonthlyTrail(dto.monthIso) };
  }

  @Post('nav/refresh')
  async refreshNav(): Promise<NavRefreshResult> {
    return this.jobs.refreshNavs();
  }
}
