import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  type JwtPayload,
  type LeadDto,
  type PartnerDto,
  UserRole,
} from '@wealthos/shared-types';
import { CurrentUser } from '../../core/current-user.decorator';
import { Public } from '../../core/public.decorator';
import { Roles } from '../../core/roles.decorator';
import {
  type CaptureLeadDto,
  type ListLeadsQuery,
  type UpdateLeadStatusDto,
  type UpsertPartnerProfileDto,
} from './partners.dto';
import { PartnersService } from './partners.service';

@Controller('partners')
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  /** @param username public slug for the white-label landing page. */
  @Public()
  @Get('public/:username')
  async publicProfile(@Param('username') username: string): Promise<PartnerDto> {
    return this.partners.getPublicProfile(username);
  }

  /** @param username public slug; @param dto captured lead form. */
  @Public()
  @Post('public/:username/leads')
  async captureLead(
    @Param('username') username: string,
    @Body() dto: CaptureLeadDto,
  ): Promise<{ received: true }> {
    return this.partners.captureLead(username, dto);
  }

  /** @param me advisor principal. */
  @Roles(UserRole.ADVISOR, UserRole.ADMIN)
  @Get('me')
  async myProfile(@CurrentUser() me: JwtPayload): Promise<PartnerDto> {
    return this.partners.getMyProfile({ id: me.sub, role: me.role });
  }

  /** @param me advisor principal; @param dto profile fields to upsert. */
  @Roles(UserRole.ADVISOR, UserRole.ADMIN)
  @Put('me')
  async upsertProfile(
    @CurrentUser() me: JwtPayload,
    @Body() dto: UpsertPartnerProfileDto,
  ): Promise<PartnerDto> {
    return this.partners.upsertMyProfile({ id: me.sub, role: me.role }, dto);
  }

  /** @param me advisor principal; @param query optional lead status. */
  @Roles(UserRole.ADVISOR, UserRole.ADMIN)
  @Get('leads')
  async leads(@CurrentUser() me: JwtPayload, @Query() query: ListLeadsQuery): Promise<LeadDto[]> {
    return this.partners.listLeads({ id: me.sub, role: me.role }, query.status);
  }

  /** @param me advisor principal; @param id lead id; @param dto next status. */
  @Roles(UserRole.ADVISOR, UserRole.ADMIN)
  @Patch('leads/:id')
  async updateLead(
    @CurrentUser() me: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
  ): Promise<LeadDto> {
    return this.partners.updateLeadStatus({ id: me.sub, role: me.role }, id, dto.status);
  }

  /** @param me admin principal. */
  @Roles(UserRole.ADMIN)
  @Get()
  async all(@CurrentUser() me: JwtPayload): Promise<PartnerDto[]> {
    return this.partners.listAll({ id: me.sub, role: me.role });
  }
}
