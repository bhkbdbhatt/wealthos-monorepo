import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const SEGMENT_FIELD_VALUES = [
  'full_name',
  'email',
  'current_value_paise',
  'invested_paise',
  'gain_pct',
  'kyc_state',
  'asset_types',
  'sip_count',
  'transaction_count',
  'created_at',
] as const;

export const SEGMENT_OPERATOR_VALUES = [
  'EQ',
  'NEQ',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'CONTAINS',
  'STARTS_WITH',
  'IN',
  'NOT_IN',
  'IS_TRUE',
  'IS_FALSE',
] as const;

export class SegmentConditionDto {
  @IsIn(SEGMENT_FIELD_VALUES)
  field!: (typeof SEGMENT_FIELD_VALUES)[number];

  @IsIn(SEGMENT_OPERATOR_VALUES)
  operator!: (typeof SEGMENT_OPERATOR_VALUES)[number];

  @IsOptional()
  value?: string | number | string[];
}

export class SegmentGroupDto {
  @IsIn(['AND', 'OR'])
  combinator!: 'AND' | 'OR';

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => SegmentConditionDto)
  conditions!: SegmentConditionDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SegmentGroupDto)
  groups?: SegmentGroupDto[];
}

export class SegmentRuleDto {
  @ValidateNested()
  @Type(() => SegmentGroupDto)
  root!: SegmentGroupDto;
}

export class CreateSegmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @ValidateNested()
  @Type(() => SegmentRuleDto)
  rule!: SegmentRuleDto;
}

export class UpdateSegmentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SegmentRuleDto)
  rule?: SegmentRuleDto;
}

export class PreviewSegmentDto {
  @ValidateNested()
  @Type(() => SegmentRuleDto)
  rule!: SegmentRuleDto;
}
