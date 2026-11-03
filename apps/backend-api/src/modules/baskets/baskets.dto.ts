import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class BuyBasketDto {
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsInt()
  @Min(100)
  @Max(10_000_000_000)
  amountPaise!: number;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}

export class BasketSlugParams {
  @IsString()
  slug!: string;
}
