import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { type JwtPayload, type SipDto } from '@wealthos/shared-types';
import { CurrentUser } from '../../core/current-user.decorator';
import { SipsService } from './sips.service';

export class CreateSipDto {
  @IsString()
  assetSlug!: string;

  @IsInt()
  @IsPositive()
  @Max(1_000_000_000)
  monthlyAmountPaise!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  intervalsPerMonth?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsInt({ each: true })
  preferredDays?: number[];

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  startOn?: string;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  endOn?: string;

  @IsOptional()
  @IsString()
  targetUserId?: string;
}

export class ListSipsQuery {
  @IsOptional()
  @IsString()
  userId?: string;
}

@Controller('sips')
export class SipsController {
  constructor(private readonly sips: SipsService) {}

  /** @param me principal; @param dto SIP creation (multi-day splits supported). */
  @Post()
  async create(@CurrentUser() me: JwtPayload, @Body() dto: CreateSipDto): Promise<SipDto> {
    const sip = await this.sips.createSip(
      { id: me.sub, role: me.role },
      {
        assetSlug: dto.assetSlug,
        monthlyAmountPaise: dto.monthlyAmountPaise,
        intervalsPerMonth: dto.intervalsPerMonth,
        preferredDays: dto.preferredDays,
        startOn: dto.startOn,
        endOn: dto.endOn ?? null,
        targetUserId: dto.targetUserId,
      },
    );
    await this.sips.scheduleInstances(sip.id, 4);
    return sip;
  }

  /** @param me principal; @param query advisor scope. */
  @Get()
  async list(@CurrentUser() me: JwtPayload): Promise<SipDto[]> {
    return this.sips.listMine({ id: me.sub, role: me.role });
  }

  /** @param me principal; @param id sip id. */
  @Patch(':id/pause')
  async pauseSip(@CurrentUser() me: JwtPayload, @Param('id') id: string): Promise<SipDto> {
    return this.sips.pause({ id: me.sub, role: me.role }, id);
  }

  /** @param me principal; @param id sip id. */
  @Patch(':id/resume')
  async resumeSip(@CurrentUser() me: JwtPayload, @Param('id') id: string): Promise<SipDto> {
    return this.sips.resume({ id: me.sub, role: me.role }, id);
  }

  /** @param me principal; @param id sip id. */
  @Delete(':id')
  async cancelSip(@CurrentUser() me: JwtPayload, @Param('id') id: string): Promise<SipDto> {
    return this.sips.cancel({ id: me.sub, role: me.role }, id);
  }
}
