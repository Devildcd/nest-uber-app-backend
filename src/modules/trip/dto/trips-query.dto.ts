import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { PaymentMode, TripStatus } from "../entities/trip.entity";

export class TripsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @IsUUID()
  passengerId?: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;

  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  // rangos útiles
  @IsOptional()
  @IsDateString()
  requestedFrom?: string;

  @IsOptional()
  @IsDateString()
  requestedTo?: string;

  @IsOptional()
  @IsDateString()
  completedFrom?: string;

  @IsOptional()
  @IsDateString()
  completedTo?: string;
}