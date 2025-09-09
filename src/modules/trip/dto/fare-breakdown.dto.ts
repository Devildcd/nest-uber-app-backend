import { IsNumber, IsOptional, Min } from 'class-validator';

export class FareBreakdownDto {
  @IsOptional() @IsNumber() @Min(0) base_fare?: number;
  @IsOptional() @IsNumber() @Min(0) distance_fare?: number;
  @IsOptional() @IsNumber() @Min(0) time_fare?: number;
  @IsOptional() @IsNumber() @Min(0) surge_multiplier?: number;
  @IsOptional() @IsNumber() @Min(0) discounts?: number;
  @IsOptional() @IsNumber() @Min(0) waiting_time_minutes?: number;
}
