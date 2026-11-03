import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { UserRole } from '@wealthos/shared-types';
import { type JwtPayload } from '@wealthos/shared-types';
import { IsOptional, IsString, Matches } from 'class-validator';
import { CurrentUser } from '../../core/current-user.decorator';
import { Public } from '../../core/public.decorator';
import { Roles } from '../../core/roles.decorator';
import { KycService } from './kyc.service';

export class ValidatePanDto {
  @IsString()
  @Matches(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, { message: 'PAN must match AAAAA9999A' })
  pan!: string;
}

export class AadhaarEsignDto {
  @IsString()
  @Matches(/^[Xx*•]{8}\d{4}$/, { message: 'Aadhaar must be sent masked like XXXXXXXX1234' })
  maskedAadhaar!: string;
}

export class VideoKycWebhookDto {
  @IsString()
  vendorRef!: string;

  @IsOptional()
  @IsString()
  token!: string;
}

/** KYC endpoints: own-pipeline steps are CLIENT; webhooks are vendor-authenticated separately. */
@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  /** @param me principal — current state + timeline. */
  @Get('me/state')
  async state(@CurrentUser() me: JwtPayload): Promise<unknown> {
    return this.kyc.getState(me.sub);
  }

  /** @param me principal */
  @Get('me/timeline')
  async timeline(@CurrentUser() me: JwtPayload): Promise<unknown> {
    return this.kyc.timeline(me.sub);
  }

  /** @param me principal; @param dto PAN payload. */
  @Put('me/pan')
  async validatePan(@CurrentUser() me: JwtPayload, @Body() dto: ValidatePanDto): Promise<unknown> {
    return this.kyc.validatePan(me.sub, dto.pan);
  }

  /** @param me principal */
  @Post('me/digilocker')
  async syncDigi(@CurrentUser() me: JwtPayload): Promise<unknown> {
    return this.kyc.syncDigilocker(me.sub);
  }

  /** @param me principal; @param dto masked Aadhaar. */
  @Post('me/aadhaar-esign')
  async esign(@CurrentUser() me: JwtPayload, @Body() dto: AadhaarEsignDto): Promise<unknown> {
    return this.kyc.aadhaarEsign(me.sub, dto.maskedAadhaar);
  }

  /** @param me principal */
  @Post('me/video-kyc/schedule')
  async scheduleVideo(@CurrentUser() me: JwtPayload): Promise<unknown> {
    return this.kyc.scheduleVideoKyc(me.sub);
  }

  /** @param dto vendor webhook body */
  @Public()
  @Post('webhook/video-kyc')
  async webhookVideo(@Body() dto: VideoKycWebhookDto): Promise<unknown> {
    return this.kyc.completeVideoKyc(dto.vendorRef, dto.token ?? '');
  }

  /** @param userId target */
  @Post(':userId/complete')
  @Roles(UserRole.ADMIN)
  async adminComplete(@Param('userId') userId: string): Promise<unknown> {
    return this.kyc.adminComplete(userId);
  }
}
