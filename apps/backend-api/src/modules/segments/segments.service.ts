import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '@wealthos/database';
import {
  UserRole,
  type SegmentDto,
  type SegmentPreviewDto,
  type SegmentRuleAst,
} from '@wealthos/shared-types';
import { type ClientSegmentRow, matchesSegment } from '../../domain/segment-eval';
import {
  type CreateSegmentDto,
  type PreviewSegmentDto,
  type UpdateSegmentDto,
} from './segments.dto';

export interface SegmentCsvResult {
  filename: string;
  csv: string;
  rowCount: number;
}

/**
 * Dynamic client segmenter (Module B2): saved AND/OR rule trees evaluated over
 * advisor-scoped client aggregates, with preview and CSV export.
 */
@Injectable()
export class SegmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** @param me advisor/admin principal @returns saved segments. */
  async list(me: { id: string; role: UserRole }): Promise<SegmentDto[]> {
    const ownerId = this.requireManager(me);
    const segments = await this.prisma.segment.findMany({
      where: ownerId === null ? undefined : { ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return segments.map((segment) => this.toDto(segment));
  }

  /**
   * @param me advisor/admin principal
   * @param input saved name + rule tree
   */
  async create(me: { id: string; role: UserRole }, input: CreateSegmentDto): Promise<SegmentDto> {
    const ownerId = this.requireManager(me);
    if (ownerId === null) throw new ForbiddenException('Admins cannot own saved segments');
    const segment = await this.prisma.segment.create({
      data: {
        ownerId,
        name: input.name,
        description: input.description ?? null,
        rule: input.rule as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toDto(segment);
  }

  /**
   * @param me advisor/admin principal
   * @param id segment id
   * @param input partial fields
   */
  async update(
    me: { id: string; role: UserRole },
    id: string,
    input: UpdateSegmentDto,
  ): Promise<SegmentDto> {
    const segment = await this.assertOwned(me, id);
    const updated = await this.prisma.segment.update({
      where: { id: segment.id },
      data: {
        name: input.name ?? segment.name,
        description: input.description ?? segment.description,
        rule:
          input.rule === undefined
            ? undefined
            : (input.rule as unknown as Prisma.InputJsonValue),
      },
    });
    return this.toDto(updated);
  }

  /** @param me advisor/admin principal @param id segment id */
  async remove(me: { id: string; role: UserRole }, id: string): Promise<{ deleted: true }> {
    const segment = await this.assertOwned(me, id);
    await this.prisma.segment.delete({ where: { id: segment.id } });
    return { deleted: true };
  }

  /**
   * @param me advisor/admin principal
   * @param input rule to preview without saving
   */
  async preview(
    me: { id: string; role: UserRole },
    input: PreviewSegmentDto,
  ): Promise<SegmentPreviewDto> {
    const rows = await this.scopedRows(me);
    const matched = rows.filter((row) =>
      matchesSegment(row, input.rule as unknown as SegmentRuleAst),
    );
    return {
      estimatedClients: matched.length,
      sampleFullNames: matched.slice(0, 10).map((row) => row.full_name),
    };
  }

  /**
   * @param me advisor/admin principal
   * @param id saved segment id
   * @returns CSV payload for download
   */
  async exportCsv(me: { id: string; role: UserRole }, id: string): Promise<SegmentCsvResult> {
    const segment = await this.assertOwned(me, id);
    const rows = await this.scopedRows(me);
    const rule = segment.rule as unknown as SegmentRuleAst;
    const matched = rows.filter((row) => matchesSegment(row, rule));
    const columns = [
      'full_name',
      'email',
      'current_value_paise',
      'invested_paise',
      'gain_pct',
      'kyc_state',
      'asset_types',
      'sip_count',
      'transaction_count',
    ];
    const csv = [
      columns.join(','),
      ...matched.map((row) =>
        [
          row.full_name,
          row.email,
          String(row.current_value_paise),
          String(row.invested_paise),
          row.gain_pct.toFixed(2),
          row.kyc_state,
          row.asset_types.join('|'),
          String(row.sip_count),
          String(row.transaction_count),
        ]
          .map(csvCell)
          .join(','),
      ),
    ].join('\n');
    return {
      filename: `${slugify(segment.name)}-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      rowCount: matched.length,
    };
  }

  /** @param me principal @returns a numeric advisor id, or null for ADMIN (all clients). */
  private requireManager(me: { id: string; role: UserRole }): string | null {
    if (me.role === UserRole.ADVISOR) return me.id;
    if (me.role === UserRole.ADMIN) return null;
    throw new ForbiddenException('Segments are available to advisors and admins only');
  }

  private async assertOwned(
    me: { id: string; role: UserRole },
    id: string,
  ): Promise<{ id: string; ownerId: string; name: string; description: string | null; rule: Prisma.JsonValue; createdAt: Date }> {
    const segment = await this.prisma.segment.findUnique({ where: { id } });
    if (!segment) throw new NotFoundException('Segment not found');
    if (me.role === UserRole.ADVISOR && segment.ownerId !== me.id) {
      throw new ForbiddenException('Not your segment');
    }
    if (me.role !== UserRole.ADVISOR && me.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Segments are available to advisors and admins only');
    }
    return segment;
  }

  private async scopedRows(me: { id: string; role: UserRole }): Promise<ClientSegmentRow[]> {
    const ownerId = this.requireManager(me);
    const clients = await this.prisma.user.findMany({
      where: {
        role: 'CLIENT',
        ...(ownerId === null ? {} : { advisorId: ownerId }),
      },
      include: {
        kyc: { select: { state: true } },
        portfolio: {
          where: { units: { gt: 0 } },
          include: { asset: { select: { navPaise: true, type: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const clientIds = clients.map((client) => client.id);
    const [sipCounts, transactionCounts] = await Promise.all([
      this.prisma.sip.groupBy({
        by: ['userId'],
        where: { userId: { in: clientIds }, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['userId'],
        where: { userId: { in: clientIds } },
        _count: { _all: true },
      }),
    ]);
    const sipsByUser = new Map(sipCounts.map((row) => [row.userId, row._count._all]));
    const txByUser = new Map(transactionCounts.map((row) => [row.userId, row._count._all]));
    return clients.map((client) => {
      const investedPaise = client.portfolio.reduce(
        (sum, holding) => sum + holding.investedPaise,
        0,
      );
      const currentPaise = client.portfolio.reduce(
        (sum, holding) => sum + Math.round(Number(holding.units) * holding.asset.navPaise),
        0,
      );
      const gainPct =
        investedPaise > 0
          ? Math.round(((currentPaise - investedPaise) / investedPaise) * 10000) / 100
          : 0;
      return {
        id: client.id,
        full_name: client.fullName,
        email: client.email,
        current_value_paise: currentPaise,
        invested_paise: investedPaise,
        gain_pct: gainPct,
        kyc_state: client.kyc?.state ?? 'INITIATED',
        asset_types: [...new Set(client.portfolio.map((holding) => holding.asset.type))],
        sip_count: sipsByUser.get(client.id) ?? 0,
        transaction_count: txByUser.get(client.id) ?? 0,
        created_at: client.createdAt.toISOString(),
      };
    });
  }

  private toDto(segment: {
    id: string;
    name: string;
    description: string | null;
    rule: Prisma.JsonValue;
    createdAt: Date;
  }): SegmentDto {
    return {
      id: segment.id,
      name: segment.name,
      description: segment.description,
      rule: segment.rule as unknown as SegmentRuleAst,
      createdAt: segment.createdAt.toISOString(),
    };
  }
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
