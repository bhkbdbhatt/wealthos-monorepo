import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
  Type,
  ValidateNested,
} from 'class-validator';
import { type JwtPayload, type PaginatedTransactions, type TransactionDto, TransactionType } from '@wealthos/shared-types';
import { CurrentUser } from '../../core/current-user.decorator';
import { CreateTransactionInput } from '@wealthos/shared-types';

export class ExecuteTransactionDto implements CreateTransactionInput {
  /** Optional CLIENT scoping for advisor executions. */
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsString()
  assetSlug!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  idempotencyKey!: string;

  @IsPositive()
  type: TransactionType.BUY | TransactionType.SELL = TransactionType.BUY;

  @IsInt()
  @IsPositive()
  amountPaise!: number;

  @IsOptional()
  @IsString()
  switchToAssetSlug?: string;
}

export class BulkTransactionsDto {
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ExecuteTransactionDto)
  items!: ExecuteTransactionDto[];
}

export class ListTransactionsQuery {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  /** @param me principal; @param dto execution body (idempotent). */
  @Post()
  async execute(
    @CurrentUser() me: JwtPayload,
    @Body() dto: ExecuteTransactionDto,
  ): Promise<TransactionDto> {
    return this.transactions.execute(me.sub, me.role, {
      assetSlug: dto.assetSlug,
      type: dto.type,
      amountPaise: dto.amountPaise,
      idempotencyKey: dto.idempotencyKey,
      switchToAssetSlug: dto.switchToAssetSlug,
      targetUserId: dto.targetUserId,
    });
  }

  /** @param me principal; @param dto bulk execution list (max 40). */
  @Post('bulk')
  async bulk(
    @CurrentUser() me: JwtPayload,
    @Body() dto: BulkTransactionsDto,
  ): Promise<TransactionDto[]> {
    return this.transactions.executeBulk(me.sub, me.role, dto.items);
  }

  /** @param me principal; @param query pagination / advisor scoping. */
  @Get()
  async list(
    @CurrentUser() me: JwtPayload,
    @Query() query: ListTransactionsQuery,
  ): Promise<PaginatedTransactions> {
    return this.transactions.list(
      { id: me.sub, role: me.role },
      query.userId,
      query.page ?? 1,
      query.pageSize ?? 25,
    );
  }
}
