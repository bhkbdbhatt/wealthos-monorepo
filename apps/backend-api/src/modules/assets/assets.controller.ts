import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { type AssetDto, AssetType, UserRole } from '@wealthos/shared-types';
import { Roles } from '../../core/roles.decorator';
import {
  CreateAssetDto,
  ListAssetsQuery,
  UpsertNavDto,
} from './assets.dto';
import { AssetsService } from './assets.service';

/** Asset catalogue endpoints. Admins maintain; everyone else consumes. */
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  /** @param query optional asset-type filter. */
  @Get()
  async list(@Query() query: ListAssetsQuery): Promise<AssetDto[]> {
    return this.assets.listAssets(query.type);
  }

  /** @param slug url slug + trailing NAV history. */
  @Get(':slug')
  async detail(
    @Param('slug') slug: string,
  ): Promise<Awaited<ReturnType<AssetsService['getAssetWithHistory']>>> {
    return this.assets.getAssetWithHistory(slug);
  }

  /** @param dto asset creation fields (ADMIN) */
  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() dto: CreateAssetDto): Promise<{ id: string }> {
    return this.assets.createAsset(dto);
  }

  /** @param dto today's NAV in integer paise (ADMIN) */
  @Post(':slug/nav')
  @Roles(UserRole.ADMIN)
  async upsertNav(
    @Param('slug') slug: string,
    @Body() dto: UpsertNavDto,
  ): Promise<{ navUpdatedAt: string }> {
    return this.assets.upsertTodayNav(slug, dto.navPaise);
  }
}
