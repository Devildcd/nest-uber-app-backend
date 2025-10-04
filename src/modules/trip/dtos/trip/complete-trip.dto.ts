import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CompleteTripDto {
  @IsUUID()
  driverId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualDistanceKm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualDurationMin?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  extraFees?: number | null;
}
