import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@wealthos/database';
import { type AssetType } from '@wealthos/shared-types';

/** Slugs are url-safe; scheme codes are unique per regulation. */
export interface UpsertAssetInput {
  slug: string;
  name: string;
  type: AssetType;
  schemeCode: string;
  issuer: string;
  category?: string;
}

/**
 * Asset catalogue + NAV maintenance. NAV updates are pushed by the daily cron
 * (infinite more trustworthy than ad-hoc manual edits in prod) and by admin API.
 */
@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param slug url slug
   * @returns Asset row with the current NAV + last 90 NAV points.
   */
  async getAssetWithHistory(slug: string): Promise<{
    id: string;
    slug: string;
    name: string;
    type: AssetType;
    schemeCode: string;
    issuer: string;
    category: string | null;
    navPaise: number;
    navUpdatedAt: string;
    navHistory: Array<{ date: string; navPaise: number }>;
  }> {
    const asset = await this.prisma.asset.findUnique({ where: { slug } });
    if (!asset) throw new NotFoundException('Asset not found');
    const history = await this.prisma.navHistory.findMany({
      where: { assetId: asset.id },
      orderBy: [{ date: 'asc' }],
      take: 90,
    });
    return {
      id: asset.id,
      slug: asset.slug,
      name: asset.name,
      type: asset.type as AssetType,
      schemeCode: asset.schemeCode,
      issuer: asset.issuer,
      category: asset.category,
      navPaise: asset.navPaise,
      navUpdatedAt: asset.navUpdatedAt.toISOString(),
      navHistory: history.map((p) => ({ date: p.date.toISOString().slice(0, 10), navPaise: p.navPaise })),
    };
  }

  /**
   * @returns every asset; type filter optional.
   */
  async listAssets(type?: AssetType): Promise<
    Array<{
      id: string;
      slug: string;
      name: string;
      type: AssetType;
      schemeCode: string;
      issuer: string;
      category: string | null;
      navPaise: number;
      navUpdatedAt: string;
    }>
  > {
    const assets = await this.prisma.asset.findMany({
      where: type ? { type } : undefined,
      orderBy: [{ name: 'asc' }],
    });
    return assets.map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      type: a.type as AssetType,
      schemeCode: a.schemeCode,
      issuer: a.issuer,
      category: a.category,
      navPaise: a.navPaise,
      navUpdatedAt: a.navUpdatedAt.toISOString(),
    }));
  }

  /**
   * Creates an asset with today's NAV as the first history point.
   * @param input validated upsert input
   */
  async createAsset(input: UpsertAssetInput): Promise<{ id: string }> {
    const existing = await this.prisma.asset.findUnique({ where: { slug: input.slug } });
    if (existing) throw new ConflictException('Asset slug already exists');
    const today = new Date();
    const asset = await this.prisma.asset.create({
      data: {
        slug: input.slug,
        name: input.name,
        type: input.type,
        schemeCode: input.schemeCode,
        issuer: input.issuer,
        category: input.category ?? null,
        navPaise: 0,
        navHistory: { create: [] },
      },
    });
    await this.prisma.navHistory.create({
      data: { assetId: asset.id, date: today, navPaise: 0 },
    });
    return { id: asset.id };
  }

  /**
   * Appends/replaces today's NAV with a known value and updates the live NAV.
   * @param slug asset slug
   * @param navPaise integer paise NAV
   */
  async upsertTodayNav(slug: string, navPaise: number): Promise<{ navUpdatedAt: string }> {
    if (!Number.isInteger(navPaise) || navPaise <= 0) {
      throw new BadRequestException('nav > 0 in paise required');
    }
    const asset = await this.prisma.asset.findUnique({ where: { slug } });
    if (!asset) throw new NotFoundException('Asset not found');
    const today = new Date();
    await this.prisma.$transaction([
      this.prisma.navHistory.upsert({
        where: { assetId_date: { assetId: asset.id, date: today } },
        create: { assetId: asset.id, date: today, navPaise },
        update: { navPaise },
      }),
      this.prisma.asset.update({ where: { id: asset.id }, data: { navPaise, navUpdatedAt: today } }),
    ]);
    return { navUpdatedAt: today.toISOString() };
  }

  /** Bulk NAV refresh used by the daily cron (idempotent per asset/date). */
  async bulkUpsertNav(points: Array<{ slug: string; navPaise: number; date: Date }>): Promise<number> {
    let updated = 0;
    for (const p of points) {
      const asset = await this.prisma.asset.findUnique({ where: { slug: p.slug } });
      if (!asset) continue;
      await this.prisma.$transaction([
        this.prisma.navHistory.upsert({
          where: { assetId_date: { assetId: asset.id, date: p.date } },
          create: { assetId: asset.id, date: p.date, navPaise: p.navPaise },
          update: { navPaise: p.navPaise },
        }),
        this.prisma.asset.update({ where: { id: asset.id }, data: { navPaise: p.navPaise, navUpdatedAt: p.date } }),
      ]);
      updated++;
    }
    return updated;
  }
}
