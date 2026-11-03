import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { type JwtPayload, type UserDto, UserRole } from '@wealthos/shared-types';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { Roles } from '../../core/roles.decorator';
import { CurrentUser } from '../../core/current-user.decorator';
import { type UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** @param me requester principal */
  @Get('me')
  async me(@CurrentUser() me: JwtPayload): Promise<UserDto> {
    return this.users.getUser(me.sub);
  }

  /** @param email lookup */
  @Get('by-email')
  @Roles(UserRole.ADMIN)
  async byEmail(@Query('email') email: string): Promise<UserDto> {
    return this.users.getUserByEmail(email);
  }

  /** @param id target user */
  @Get('by-id/:id')
  @Roles(UserRole.ADMIN)
  async byId(@Param('id') id: string): Promise<UserDto> {
    return this.users.getUser(id);
  }

  /** @param me advisor principal */
  @Get('advisor-clients')
  @Roles(UserRole.ADVISOR, UserRole.ADMIN)
  async advisorClients(@CurrentUser() me: JwtPayload): Promise<UserDto[]> {
    return this.users.listAdvisorClients(me.sub, me.role);
  }
}
