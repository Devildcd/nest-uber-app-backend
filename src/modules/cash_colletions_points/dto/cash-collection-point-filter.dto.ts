// src/modules/payments/dto/cash-collection-point-filter.dto.ts
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CashCollectionPointFilterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  nearbyCoordinates?: [number, number]; // [longitude, latitude]

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  radius?: number; // in kilometers
}
