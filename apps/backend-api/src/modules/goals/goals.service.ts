import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type PrismaService } from '@wealthos/database';
import { UserRole, type GoalDto } from '@wealthos/shared-types';
import { goalProgress, recommendMonthlySip } from '../../domain/goal-planner';
import { type UsersService } from '../users/users.service';
import { type CreateGoalDto, type UpdateGoalDto } from './goals.dto';

interface GoalRow {
  id: string;
  userId: string;
  name: string;
  targetAmountPaise: number;
  horizonMonths: number;
  expectedAnnualReturnBps: number;
  recommendedMonthlyPaise: number;
  startDate: Date;
}

/**
 * Thematic goal mapper (Module C2): target + horizon -> monthly SIP
 * recommendation, plus live progress against the user's current holdings.
 */
@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  /**
   * @param me caller principal
   * @param targetUserId optional advisor-scoped client id
   * @returns goals enriched with live progress
   */
  async list(me: { id: string; role: UserRole }, targetUserId?: string): Promise<GoalDto[]> {
    const owner = await this.resolveOwner(me, targetUserId);
    const [goals, currentValuePaise] = await Promise.all([
      this.prisma.goal.findMany({ where: { userId: owner }, orderBy: { createdAt: 'desc' } }),
      this.currentPortfolioValue(owner),
    ]);
    return goals.map((goal) => this.toDto(goal, currentValuePaise));
  }

  /**
   * @param me caller principal
   * @param input goal parameters
   * @returns the persisted goal with recommendation
   */
  async create(me: { id: string; role: UserRole }, input: CreateGoalDto): Promise<GoalDto> {
    const owner = await this.resolveOwner(me, input.targetUserId);
    const recommendation = recommendMonthlySip({
      targetAmountPaise: input.targetAmountPaise,
      horizonMonths: input.horizonMonths,
      expectedAnnualReturnBps: input.expectedAnnualReturnBps,
    });
    const goal = await this.prisma.goal.create({
      data: {
        userId: owner,
        name: input.name,
        targetAmountPaise: input.targetAmountPaise,
        horizonMonths: input.horizonMonths,
        expectedAnnualReturnBps: input.expectedAnnualReturnBps,
        recommendedMonthlyPaise: recommendation.recommendedMonthlyPaise,
        startDate: new Date(),
      },
    });
    return this.toDto(goal, await this.currentPortfolioValue(owner));
  }

  /**
   * @param me caller principal
   * @param goalId target goal
   * @param input partial updates; recommendation is recalculated
   */
  async update(
    me: { id: string; role: UserRole },
    goalId: string,
    input: UpdateGoalDto,
  ): Promise<GoalDto> {
    const goal = await this.assertOwned(me, goalId);
    const merged = {
      targetAmountPaise: input.targetAmountPaise ?? goal.targetAmountPaise,
      horizonMonths: input.horizonMonths ?? goal.horizonMonths,
      expectedAnnualReturnBps: input.expectedAnnualReturnBps ?? goal.expectedAnnualReturnBps,
    };
    const recommendation = recommendMonthlySip(merged);
    const updated = await this.prisma.goal.update({
      where: { id: goal.id },
      data: {
        name: input.name ?? goal.name,
        ...merged,
        recommendedMonthlyPaise: recommendation.recommendedMonthlyPaise,
      },
    });
    return this.toDto(updated, await this.currentPortfolioValue(updated.userId));
  }

  /**
   * @param me caller principal
   * @param goalId target goal
   */
  async remove(me: { id: string; role: UserRole }, goalId: string): Promise<{ deleted: true }> {
    const goal = await this.assertOwned(me, goalId);
    await this.prisma.goal.delete({ where: { id: goal.id } });
    return { deleted: true };
  }

  private async assertOwned(
    me: { id: string; role: UserRole },
    goalId: string,
  ): Promise<GoalRow> {
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal) throw new NotFoundException('Goal not found');
    if (goal.userId !== me.id) {
      if (me.role === UserRole.CLIENT) throw new ForbiddenException('Not your goal');
      if (me.role === UserRole.ADVISOR) {
        const advised = await this.users.advisedClientIds(me.id);
        if (!advised.includes(goal.userId)) throw new ForbiddenException('Not an advised client');
      }
    }
    return goal;
  }

  private async resolveOwner(
    me: { id: string; role: UserRole },
    targetUserId?: string,
  ): Promise<string> {
    if (!targetUserId || targetUserId === me.id) return me.id;
    if (me.role === UserRole.CLIENT) throw new ForbiddenException('Clients manage their own goals');
    if (me.role === UserRole.ADVISOR) {
      const advised = await this.users.advisedClientIds(me.id);
      if (!advised.includes(targetUserId)) throw new ForbiddenException('Not an advised client');
    }
    return targetUserId;
  }

  private async currentPortfolioValue(userId: string): Promise<number> {
    const holdings = await this.prisma.portfolio.findMany({
      where: { userId, units: { gt: 0 } },
      include: { asset: { select: { navPaise: true } } },
    });
    return holdings.reduce(
      (sum, holding) => sum + Math.round(Number(holding.units) * holding.asset.navPaise),
      0,
    );
  }

  private toDto(goal: GoalRow, currentValuePaise: number): GoalDto {
    const progress = goalProgress(currentValuePaise, goal.targetAmountPaise);
    return {
      id: goal.id,
      name: goal.name,
      targetAmountPaise: goal.targetAmountPaise,
      horizonMonths: goal.horizonMonths,
      expectedAnnualReturnBps: goal.expectedAnnualReturnBps,
      recommendedMonthlyPaise: goal.recommendedMonthlyPaise,
      currentValuePaise,
      startDate: goal.startDate.toISOString().slice(0, 10),
      progressPct: progress.progressPct,
      achieved: progress.achieved,
    };
  }
}
