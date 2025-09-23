// src/modules/payments/dto/cash-collection-record-filter.dto.ts
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { CashCollectionStatus } from '../entities/cash_colletion_records.entity';
import { Type } from 'class-transformer';

export class CashCollectionRecordFilterDto {
  @IsOptional()
  @IsEnum(CashCollectionStatus)
  status?: CashCollectionStatus;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsUUID()
  collectorId?: string;

  @IsOptional()
  @IsUUID()
  collectionPointId?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minAmount?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxAmount?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
