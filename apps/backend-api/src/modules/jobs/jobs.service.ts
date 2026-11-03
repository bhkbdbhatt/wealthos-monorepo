import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { type PrismaService } from '@wealthos/database';
import { type CommissionsService } from '../commissions/commissions.service';
import { type SipsService } from '../sips/sips.service';

export interface SipCronResult {
  executed: number;
  missed: number;
  failed: number;
}

export interface NavRefreshResult {
  updated: number;
  skipped: number;
  failed: number;
}

interface AmfiResponse {
  data?: Array<{ date?: string; nav?: string }>;
}

/**
 * Background jobs: daily SIP debit sweep, monthly trail commission rollover and
 * nightly mutual-fund NAV refresh from the public AMFI mirror. Everything is
 * idempotent at the database level so overlapping runs are safe.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private navRefreshRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sips: SipsService,
    private readonly commissions: CommissionsService,
  ) {}

  /** @param todayIso optional date override for manual replays. */
  @Cron(CronExpression.EVERY_DAY_AT_6AM, { name: 'daily-sip-sweep' })
  async runDailySips(todayIso?: string): Promise<SipCronResult> {
    const result: SipCronResult = { executed: 0, missed: 0, failed: 0 };
    const due = await this.sips.dueInstanceIds(todayIso);
    for (const instanceId of due) {
      try {
        const outcome = await this.sips.executeInstance(instanceId);
        if (outcome.status === 'EXECUTED') result.executed++;
        else if (outcome.status === 'MISSED') result.missed++;
        else result.failed++;
      } catch (error) {
        result.failed++;
        this.logger.error(
          `SIP instance ${instanceId} failed: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }
    this.logger.log(
      `SIP sweep: executed=${result.executed} missed=${result.missed} failed=${result.failed}`,
    );
    return result;
  }

  /**
   * @param monthIso optional "yyyy-MM"; defaults to the previous calendar month.
   * @returns number of trail rows written.
   */
  @Cron('0 2 1 * *', { name: 'monthly-trail-commission' })
  async runMonthlyTrail(monthIso?: string): Promise<number> {
    const month = monthIso ?? previousMonthIso();
    const written = await this.commissions.runMonthlyTrail(month);
    this.logger.log(`Trail commission pass for ${month}: ${written} rows`);
    return written;
  }

  /** Refresh NAVs for every imported mutual fund with a numeric AMFI scheme code. */
  @Cron(CronExpression.EVERY_DAY_AT_11PM, { name: 'nightly-nav-refresh' })
  async refreshNavs(): Promise<NavRefreshResult> {
    if (this.navRefreshRunning) {
      this.logger.warn('NAV refresh already running; skipping overlapping invocation');
      return { updated: 0, skipped: 0, failed: 0 };
    }
    this.navRefreshRunning = true;
    const result: NavRefreshResult = { updated: 0, skipped: 0, failed: 0 };
    try {
      const assets = await this.prisma.asset.findMany({
        where: { type: 'MUTUAL_FUND' },
        select: { id: true, schemeCode: true, navUpdatedAt: true },
      });
      for (const asset of assets) {
        if (!/^\d+$/.test(asset.schemeCode)) {
          result.skipped++;
          continue;
        }
        try {
          const response = await fetch(`https://api.mfapi.in/mf/${asset.schemeCode}/latest`, {
            signal: AbortSignal.timeout(8000),
            headers: { accept: 'application/json' },
          });
          if (!response.ok) {
            result.failed++;
            continue;
          }
          const payload = (await response.json()) as AmfiResponse;
          const latest = payload.data?.[0];
          const nav = latest?.nav ? Number.parseFloat(latest.nav) : Number.NaN;
          if (!latest?.date || !Number.isFinite(nav) || nav <= 0) {
            result.failed++;
            continue;
          }
          const day = parseAmfiDate(latest.date);
          if (!day) {
            result.failed++;
            continue;
          }
          const navPaise = Math.round(nav * 100);
          await this.prisma.$transaction([
            this.prisma.asset.update({
              where: { id: asset.id },
              data: { navPaise, navUpdatedAt: day },
            }),
            this.prisma.navHistory.upsert({
              where: { assetId_date: { assetId: asset.id, date: day } },
              create: { assetId: asset.id, date: day, navPaise },
              update: { navPaise },
            }),
          ]);
          result.updated++;
        } catch (error) {
          result.failed++;
          this.logger.warn(
            `NAV refresh failed for scheme ${asset.schemeCode}: ${
              error instanceof Error ? error.message : 'unknown'
            }`,
          );
        }
      }
    } finally {
      this.navRefreshRunning = false;
    }
    this.logger.log(
      `NAV refresh: updated=${result.updated} skipped=${result.skipped} failed=${result.failed}`,
    );
    return result;
  }
}

function previousMonthIso(): string {
  const now = new Date();
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return previous.toISOString().slice(0, 7);
}

function parseAmfiDate(value: string): Date | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return Number.isNaN(date.getTime()) ? null : date;
}
