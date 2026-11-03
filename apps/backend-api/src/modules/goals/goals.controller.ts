import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { type JwtPayload, type GoalDto, UserRole } from '@wealthos/shared-types';
import { CurrentUser } from '../../core/current-user.decorator';
import { Roles } from '../../core/roles.decorator';
import { type CreateGoalDto, type ListGoalsQuery, type UpdateGoalDto } from './goals.dto';
import { GoalsService } from './goals.service';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  /** @param me principal; @param query advisor scope. */
  @Get()
  @Roles(UserRole.CLIENT, UserRole.ADVISOR, UserRole.ADMIN)
  async list(@CurrentUser() me: JwtPayload, @Query() query: ListGoalsQuery): Promise<GoalDto[]> {
    return this.goals.list({ id: me.sub, role: me.role }, query.userId);
  }

  /** @param me principal; @param dto goal inputs. */
  @Post()
  @Roles(UserRole.CLIENT, UserRole.ADVISOR, UserRole.ADMIN)
  async create(@CurrentUser() me: JwtPayload, @Body() dto: CreateGoalDto): Promise<GoalDto> {
    return this.goals.create({ id: me.sub, role: me.role }, dto);
  }

  /** @param me principal; @param id goal id; @param dto partial updates. */
  @Patch(':id')
  @Roles(UserRole.CLIENT, UserRole.ADVISOR, UserRole.ADMIN)
  async update(
    @CurrentUser() me: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ): Promise<GoalDto> {
    return this.goals.update({ id: me.sub, role: me.role }, id, dto);
  }

  /** @param me principal; @param id goal id. */
  @Delete(':id')
  @Roles(UserRole.CLIENT, UserRole.ADVISOR, UserRole.ADMIN)
  async remove(@CurrentUser() me: JwtPayload, @Param('id') id: string): Promise<{ deleted: true }> {
    return this.goals.remove({ id: me.sub, role: me.role }, id);
  }
}
