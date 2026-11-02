import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AssetType } from '@wealthos/shared-types';

export class ListAssetsQuery {
  @IsOptional()
  @IsEnum(AssetType)
  type?: AssetType;
}

export class CreateAssetDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEnum(AssetType)
  type!: AssetType;

  @IsString()
  @MinLength(3)
  @MaxLength(32)
  schemeCode!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(96)
  issuer!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;
}

export class UpsertNavDto {
  @IsInt()
  @Min(1)
  @Max(10_000_000_000)
  navPaise!: number;
}
