import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@wealthos/database';
import { UserRole, type SipDto } from '@wealthos/shared-types';
import { nextDebitPlan, splitMonthlyMandate, validateSipSchedule } from '../../domain/sip-splitter';
import { TransactionsService } from '../transactions/transactions.service';
import { UsersService } from '../users/users.service';

export interface CreateSipInput {
  assetSlug: string;
  monthlyAmountPaise: number;
  intervalsPerMonth?: number;
  /** Up to 3 day anchors 1..31; provider defaults when omitted. */
  preferredDays?: number[];
  startOn?: string;
  endOn?: string | null;
  targetUserId?: string;
}

interface SipRowLike {
  id: string;
  monthlyAmountPaise: number;
  intervalsPerMonth: number;
  scheduledDays: number[];
  status: string;
  startOn: Date;
  endOn: Date | null;
  nextRunOn: Date | null;
}

interface AssetLike {
  id: string;
  slug: string;
  name: string;
  type: string;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * SIP engine (A3): monthly mandates split into N debits per month; the daily
 * cron walks due SipInstance rows. Instance execution is idempotent through the
 * unique (sipId, scheduledFor) index and the txn's unique idempotencyKey.
 */
@Injectable()
export class SipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly transactions: TransactionsService,
  ) {}

  /**
   * @param me caller principal
   * @param input validated creation payload
   */
  async createSip(me: { id: string; role: UserRole }, input: CreateSipInput): Promise<SipDto> {
    const owner = this.resolveTarget(me, input.targetUserId);
    const intervals = input.intervalsPerMonth ?? 1;
    const days: number[] = input.preferredDays ?? this.defaultDaysFor(intervals);
    const startIso = input.startOn ?? todayIso();
    const errors = validateSipSchedule({
      startOn: startIso,
      monthlyAmountPaise: input.monthlyAmountPaise,
      intervalsPerMonth: intervals,
      preferredDays: days,
      endOn: input.endOn ?? null,
    });
    if (errors.length > 0) throw new BadRequestException(errors.join('; '));
    const asset = await this.prisma.asset.findUnique({ where: { slug: input.assetSlug } });
    if (!asset) throw new NotFoundException('Asset not found');
    const perDebit = splitMonthlyMandate(input.monthlyAmountPaise, intervals);
    const nextRun = nextDebitPlan(
      {
        startOn: startIso,
        monthlyAmountPaise: input.monthlyAmountPaise,
        intervalsPerMonth: intervals,
        preferredDays: days,
        endOn: input.endOn ?? null,
      },
      1,
    )[0];
    const sip = await this.prisma.sip.create({
      data: {
        userId: owner,
        assetId: asset.id,
        monthlyAmountPaise: input.monthlyAmountPaise,
        intervalsPerMonth: intervals,
        scheduledDays: days,
        status: 'ACTIVE',
        startOn: new Date(`${startIso}T00:00:00.000Z`),
        endOn: input.endOn ? new Date(`${input.endOn}T00:00:00.000Z`) : null,
        nextRunOn: nextRun ? new Date(`${nextRun.dateIso}T00:00:00.000Z`) : null,
      },
    });
    return this.toDto(sip, asset);
  }

  /** @param me principal; @param sipId target. */
  async pause(me: { id: string; role: UserRole }, sipId: string): Promise<SipDto> {
    return this.transitionStatus(me, sipId, 'PAUSED');
  }

  /** @param me principal; @param sipId target. */
  async resume(me: { id: string; role: UserRole }, sipId: string): Promise<SipDto> {
    return this.transitionStatus(me, sipId, 'ACTIVE');
  }

  /**
   * Terminal cancellation: pending instances flip to MISSED, nextRun cleared.
   * @param me principal; @param sipId target.
   */
  async cancel(me: { id: string; role: UserRole }, sipId: string): Promise<SipDto> {
    const sip = await this.assertOwnership(me, sipId);
    const updated = await this.prisma.sip.update({
      where: { id: sip.id },
      data: { status: 'CANCELLED', nextRunOn: null },
    });
    await this.prisma.sipInstance.updateMany({
      where: { sipId, status: 'SCHEDULED' },
      data: { status: 'MISSED' },
    });
    return this.toDto(updated, (await this.prisma.asset.findUnique({ where: { id: updated.assetId } })) as AssetLike);
  }

  /**
   * List SIPs for the caller (CLIENT) or an advised target (ADVISOR/ADMIN).
   * @param me principal; @param targetUserId optional scope.
   */
  async listMine(me: { id: string; role: UserRole }, targetUserId?: string): Promise<SipDto[]> {
    const owner = this.resolveTarget(me, targetUserId);
    const sips = await this.prisma.sip.findMany({
      where: { userId: owner },
      orderBy: [{ createdAt: 'desc' }],
      include: { asset: true },
    });
    return sips.map((s) => this.toDto(s, s.asset));
  }

  /**
   * Idempotently executes one scheduled debit.
   * Creates the TXN at today's NAV; flips the instance status; advances nextRunOn.
   * @param instanceId SipInstance id
   */
  async executeInstance(instanceId: string): Promise<{ status: string; transactionId: string | null }> {
    const instance = await this.prisma.sipInstance.findUnique({
      where: { id: instanceId },
      include: { sip: true },
    });
    if (!instance) throw new NotFoundException('SIP instance not found');
    if (instance.status === 'EXECUTED') {
      return { status: 'EXECUTED', transactionId: instance.transactionId };
    }
    if (instance.sip.status !== 'ACTIVE') {
      await this.prisma.sipInstance.update({ where: { id: instance.id }, data: { status: 'MISSED' } });
      return { status: 'MISSED', transactionId: null };
    }
    const asset = await this.prisma.asset.findUnique({ where: { id: instance.sip.assetId } });
    if (!asset) {
      await this.prisma.sipInstance.update({ where: { id: instance.id }, data: { status: 'FAILED' } });
      return { status: 'FAILED', transactionId: null };
    }
    try {
      const transactionId = await this.prisma.$transaction(async (tx) => {
        const idempotencyKey = `sip:${instance.id}`;
        const existing = await tx.transaction.findUnique({ where: { idempotencyKey } });
        if (existing) return existing.id;
        const txn = await tx.transaction.create({
          data: {
            userId: instance.sip.userId,
            assetId: asset.id,
            type: 'SIP',
            amountPaise: instance.amountPaise,
            units: (instance.amountPaise / asset.navPaise).toFixed(8),
            navPaise: asset.navPaise,
            status: 'EXECUTED',
            executedAt: new Date(),
            idempotencyKey,
          },
        });
        await this.transactions.applyHoldingDelta(
          tx,
          instance.sip.userId,
          asset.id,
          Number(txn.units),
          instance.amountPaise,
        );
        await tx.sipInstance.update({ where: { id: instance.id }, data: { status: 'EXECUTED', transactionId: txn.id } });
        return txn.id;
      });
      await this.advanceNextRun(instance.sip);
      return { status: 'EXECUTED', transactionId };
    } catch {
      await this.prisma.sipInstance.update({ where: { id: instance.id }, data: { status: 'FAILED' } });
      await this.advanceNextRun(instance.sip);
      return { status: 'FAILED', transactionId: null };
    }
  }

  /** Instance ids due for execution — feeds the daily cron. */
  async dueInstanceIds(todayIsoOverride?: string): Promise<string[]> {
    const todayIsoValue = todayIsoOverride ?? todayIso();
    const today = new Date(`${todayIsoValue}T00:00:00.000Z`);
    const dueSips = await this.prisma.sip.findMany({
      where: {
        status: 'ACTIVE',
        nextRunOn: { lte: today },
        OR: [{ endOn: null }, { endOn: { gte: today } }],
      },
      select: { id: true },
    });
    if (dueSips.length === 0) return [];
    const instances = await this.prisma.sipInstance.findMany({
      where: { sipId: { in: dueSips.map((d) => d.id) }, status: 'SCHEDULED', scheduledFor: { lte: today } },
      select: { id: true },
    });
    return instances.map((i) => i.id);
  }

  /**
   * Upserts scheduled instances for the next `count` debit points of a SIP.
   * Called from create + after each execution rollover.
   * @param sipId target SIP id
   * @param count how many future points to pre-schedule (1 is enough with cron)
   */
  async scheduleInstances(sipId: string, count: number): Promise<string[]> {
    const sip = await this.prisma.sip.findUnique({ where: { id: sipId } });
    if (!sip) throw new NotFoundException('SIP not found');
    const fromIso =
      sip.nextRunOn && sip.nextRunOn.toISOString().slice(0, 10) > todayIso()
        ? sip.nextRunOn.toISOString().slice(0, 10)
        : todayIso();
    const points = nextDebitPlan(
      {
        startOn: fromIso,
        monthlyAmountPaise: sip.monthlyAmountPaise,
        intervalsPerMonth: sip.intervalsPerMonth,
        preferredDays: [...sip.scheduledDays],
        endOn: sip.endOn ? sip.endOn.toISOString().slice(0, 10) : null,
      },
      count,
    );
    const created: string[] = [];
    for (const p of points) {
      const exists = await this.prisma.sipInstance.findUnique({
        where: { sipId_scheduledFor: { sipId, scheduledFor: new Date(`${p.dateIso}T00:00:00.000Z`) } },
      });
      if (exists) continue;
      const instance = await this.prisma.sipInstance.create({
        data: {
          sipId,
          scheduledFor: new Date(`${p.dateIso}T00:00:00.000Z`),
          amountPaise: p.amountPaise,
          status: 'SCHEDULED',
        },
      });
      created.push(instance.id);
    }
    return created;
  }

  private async transitionStatus(me: { id: string; role: UserRole }, sipId: string, status: 'PAUSED' | 'ACTIVE'): Promise<SipDto> {
    const sip = await this.assertOwnership(me, sipId);
    const updated = await this.prisma.sip.update({ where: { id: sip.id }, data: { status } });
    const asset = await this.prisma.asset.findUnique({ where: { id: updated.assetId } });
    return this.toDto(updated, asset as AssetLike);
  }

  private async assertOwnership(me: { id: string; role: UserRole }, sipId: string): Promise<{ id: string; userId: string; assetId: string }> {
    const sip = await this.prisma.sip.findUnique({
      where: { id: sipId },
      select: { id: true, userId: true, assetId: true },
    });
    if (!sip) throw new NotFoundException('SIP not found');
    if (me.role === UserRole.CLIENT && sip.userId !== me.id) {
      throw new ForbiddenException('Not your SIP');
    }
    if (me.role === UserRole.ADVISOR) {
      const advised = await this.users.advisedClientIds(me.id);
      if (!advised.includes(sip.userId)) throw new ForbiddenException('Not an advised client');
    }
    return sip;
  }

  private resolveTarget(me: { id: string; role: UserRole }, targetUserId?: string): string {
    if (!targetUserId || targetUserId === me.id) return me.id;
    if (me.role === UserRole.CLIENT) throw new ForbiddenException('Clients manage their own SIPs');
    return targetUserId;
  }

  private defaultDaysFor(intervals: number): number[] {
    if (intervals === 1) return [5];
    if (intervals === 2) return [5, 20];
    return [1, 11, 21];
  }

  private async advanceNextRun(sip: { id: string; monthlyAmountPaise: number; intervalsPerMonth: number; scheduledDays: number[]; endOn: Date | null }): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const fromIso = tomorrow.toISOString().slice(0, 10);
    const next = nextDebitPlan(
      {
        startOn: fromIso,
        monthlyAmountPaise: sip.monthlyAmountPaise,
        intervalsPerMonth: sip.intervalsPerMonth,
        preferredDays: [...sip.scheduledDays],
        endOn: sip.endOn ? sip.endOn.toISOString().slice(0, 10) : null,
      },
      1,
    )[0];
    await this.prisma.sip.update({
      where: { id: sip.id },
      data: { nextRunOn: next ? new Date(`${next.dateIso}T00:00:00.000Z`) : null },
    });
  }

  private toDto(sip: SipRowLike, asset: AssetLike | null): SipDto {
    if (!asset) throw new NotFoundException('Asset missing for SIP');
    return {
      id: sip.id,
      asset: {
        id: asset.id,
        slug: asset.slug,
        name: asset.name,
        type: asset.type as SipDto['asset']['type'],
      },
      monthlyAmountPaise: sip.monthlyAmountPaise,
      intervalsPerMonth: sip.intervalsPerMonth,
      scheduledDays: [...sip.scheduledDays],
      status: sip.status as SipDto['status'],
      startOn: sip.startOn.toISOString().slice(0, 10),
      endOn: sip.endOn ? sip.endOn.toISOString().slice(0, 10) : null,
      nextRunOn: sip.nextRunOn ? sip.nextRunOn.toISOString().slice(0, 10) : null,
    };
  }
}
