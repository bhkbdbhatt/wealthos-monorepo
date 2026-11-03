import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type CasUploadDto,
  type JwtPayload,
  UserRole,
} from '@wealthos/shared-types';
import { IsOptional, IsUUID } from 'class-validator';
import { CurrentUser } from '../../core/current-user.decorator';
import { Roles } from '../../core/roles.decorator';
import { CasService, type CasPdfFile, type CasUploadSummary } from './cas.service';

export class UploadCasBody {
  @IsOptional()
  @IsUUID()
  targetUserId?: string;
}

export class ListCasQuery {
  @IsOptional()
  @IsUUID()
  userId?: string;
}

@Controller('cas')
@Roles(UserRole.CLIENT, UserRole.ADVISOR, UserRole.ADMIN)
export class CasController {
  constructor(private readonly cas: CasService) {}

  /**
   * @param me principal
   * @param file PDF multipart file
   * @param body optional advisor client scope
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() me: JwtPayload,
    @UploadedFile() file: CasPdfFile | undefined,
    @Body() body: UploadCasBody,
  ): Promise<CasUploadSummary> {
    return this.cas.upload({ id: me.sub, role: me.role }, file, body.targetUserId);
  }

  /** @param me principal; @param query advisor client scope. */
  @Get('uploads')
  async list(@CurrentUser() me: JwtPayload, @Query() query: ListCasQuery): Promise<CasUploadDto[]> {
    return this.cas.list({ id: me.sub, role: me.role }, query.userId);
  }

  /** @param me principal; @param id upload id. */
  @Get('uploads/:id')
  async detail(@CurrentUser() me: JwtPayload, @Param('id') id: string): Promise<CasUploadDto> {
    return this.cas.detail({ id: me.sub, role: me.role }, id);
  }
}
