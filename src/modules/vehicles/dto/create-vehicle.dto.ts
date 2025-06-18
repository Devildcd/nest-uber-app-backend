import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  IsUrl,
  IsDateString,
  Length,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VehicleType, VehicleStatus } from '../entities/vehicle.entity';

export class CreateVehicleDto {
  @IsString()
  driverId: string;

  @IsString()
  @Length(1, 50)
  make: string;

  @IsString()
  @Length(1, 50)
  model: string;

  @IsInt()
  @Min(1886) 
  year: number;

  @IsString()
  @Length(1, 15)
  plateNumber: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  color?: string;

  @IsEnum(VehicleType)
  @IsOptional()
  vehicleType?: VehicleType;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsOptional()
  @IsUrl()
  licensePlateImageUrl?: string;

  @IsOptional()
  @IsUrl()
  registrationCardUrl?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  insurancePolicyNumber?: string;

  @IsOptional()
  @IsDateString()
  insuranceExpiresAt?: string;

  @IsOptional()
  @IsDateString()
  inspectionDate?: string;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}