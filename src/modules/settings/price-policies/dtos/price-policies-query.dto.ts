import { Transform as CTransform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PricePolicyScopeType } from '../entities/price-policy.entity';

export class PricePoliciesQueryDto {
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
  limit?: number;

  @IsOptional()
  @IsEnum(PricePolicyScopeType)
  scopeType?: PricePolicyScopeType;

  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsOptional()
  @IsBoolean()
  @CTransform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  active?: boolean;

  @IsOptional()
  @IsString()
  q?: string; // name ILIKE
}
