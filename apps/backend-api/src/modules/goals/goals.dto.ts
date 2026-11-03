import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { type CreateGoalInput } from '@wealthos/shared-types';

export class CreateGoalDto implements CreateGoalInput {
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsInt()
  @IsPositive()
  @Max(10_000_000_000)
  targetAmountPaise!: number;

  @IsInt()
  @Min(1)
  @Max(720)
  horizonMonths!: number;

  @IsInt()
  @Min(0)
  @Max(5_000)
  expectedAnnualReturnBps!: number;
}

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Max(10_000_000_000)
  targetAmountPaise?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  horizonMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5_000)
  expectedAnnualReturnBps?: number;
}

export class ListGoalsQuery {
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class GoalParams {
  @IsString()
  id!: string;
}
