import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { type JwtPayload } from '@wealthos/shared-types';
import { CurrentUser } from '../../core/current-user.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { Public } from '../../core/public.decorator';
import { AuthService } from './auth.service';
import { type AuthSessionDto, type ClientRegisterDto, type LoginDto, type RefreshDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** @param dto email/password credentials */
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<AuthSessionDto> {
    return this.auth.login(dto.email, dto.password);
  }

  /**
   * Self-service CLIENT registration. Advisors/Admins are provisioned by ADMIN flows.
   * @param dto registration body
   */
  @Public()
  @Post('register/client')
  async registerClient(@Body() dto: ClientRegisterDto): Promise<AuthSessionDto> {
    return this.auth.registerClient({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      phone: dto.phone ?? '',
      ownerAdvisorUsername: dto.ownerAdvisorUsername ?? null,
    });
  }

  /** @param me principal verified from the Bearer token */
  @Get('session')
  @UseGuards(JwtAuthGuard)
  session(@CurrentUser() me: JwtPayload): JwtPayload {
    return me;
  }

  /** @param dto refresh token */
  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto): Promise<AuthSessionDto> {
    return this.auth.refresh(dto.refreshToken);
  }
}
