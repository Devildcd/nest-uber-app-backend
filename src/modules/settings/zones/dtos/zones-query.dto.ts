import { Transform as CTransform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ZonesQueryDto {
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
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @CTransform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string; // ILIKE name

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @CTransform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @CTransform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  kind?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priorityGte?: number;

  @IsOptional()
  @IsBoolean()
  @CTransform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  active?: boolean;
}
