import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  type JwtPayload,
  type SegmentDto,
  type SegmentPreviewDto,
  UserRole,
} from '@wealthos/shared-types';
import { CurrentUser } from '../../core/current-user.decorator';
import { Roles } from '../../core/roles.decorator';
import { type CreateSegmentDto, type PreviewSegmentDto, type UpdateSegmentDto } from './segments.dto';
import { SegmentsService } from './segments.service';

@Controller('segments')
@Roles(UserRole.ADVISOR, UserRole.ADMIN)
export class SegmentsController {
  constructor(private readonly segments: SegmentsService) {}

  /** @param me advisor/admin principal. */
  @Get()
  async list(@CurrentUser() me: JwtPayload): Promise<SegmentDto[]> {
    return this.segments.list({ id: me.sub, role: me.role });
  }

  /** @param me principal; @param dto saved segment definition. */
  @Post()
  async create(@CurrentUser() me: JwtPayload, @Body() dto: CreateSegmentDto): Promise<SegmentDto> {
    return this.segments.create({ id: me.sub, role: me.role }, dto);
  }

  /** @param me principal; @param dto rule to preview. */
  @Post('preview')
  async preview(
    @CurrentUser() me: JwtPayload,
    @Body() dto: PreviewSegmentDto,
  ): Promise<SegmentPreviewDto> {
    return this.segments.preview({ id: me.sub, role: me.role }, dto);
  }

  /** @param me principal; @param id segment id; @param dto partial updates. */
  @Patch(':id')
  async update(
    @CurrentUser() me: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSegmentDto,
  ): Promise<SegmentDto> {
    return this.segments.update({ id: me.sub, role: me.role }, id, dto);
  }

  /** @param me principal; @param id segment id. */
  @Delete(':id')
  async remove(@CurrentUser() me: JwtPayload, @Param('id') id: string): Promise<{ deleted: true }> {
    return this.segments.remove({ id: me.sub, role: me.role }, id);
  }

  /** @param me principal; @param id segment id; @param res download headers. */
  @Get(':id/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(
    @CurrentUser() me: JwtPayload,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const result = await this.segments.exportCsv({ id: me.sub, role: me.role }, id);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Row-Count', String(result.rowCount));
    return result.csv;
  }
}
