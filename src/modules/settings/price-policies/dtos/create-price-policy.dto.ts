import { Transform as CTransform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PricePolicyScopeType } from '../entities/price-policy.entity';
import { IsPricePolicyConditions } from 'src/common/validators/is-price-policy-conditions.decorator';
import { IsPricePolicyPrice } from 'src/common/validators/is-price-policy-price.decorator';
import { IsPricePolicyScopeCoherent } from 'src/common/validators/is-price-policy-scope-coherence.decorator';

export class CreatePricePolicyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  @CTransform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @IsEnum(PricePolicyScopeType)
  @IsPricePolicyScopeCoherent()
  scopeType!: PricePolicyScopeType;

  @IsOptional()
  @IsUUID()
  cityId?: string | null;

  @IsOptional()
  @IsUUID()
  zoneId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100000)
  priority?: number;

  @IsOptional()
  @Type(() => Date)
  effectiveFrom?: Date | null;

  @IsOptional()
  @Type(() => Date)
  effectiveTo?: Date | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @CTransform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  timezone?: string; // valida IANA si ya tienes decorador IsIanaTimezone

  @IsOptional()
  @IsPricePolicyConditions()
  conditions?: Record<string, any>;

  @IsPricePolicyPrice()
  price!: Record<string, any>;

  @IsOptional()
  @IsUUID()
  updatedBy?: string | null;
}
