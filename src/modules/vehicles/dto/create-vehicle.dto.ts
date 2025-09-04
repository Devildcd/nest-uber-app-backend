import { IsUUID, IsString, IsInt, IsOptional, IsBoolean, IsEnum, IsDateString, MaxLength, Min, Max } from 'class-validator';
import { VehicleStatus } from '../entities/vehicle.entity';

export class CreateVehicleDto {
  @IsUUID()
  driverId: string;

  @IsUUID()
  driverProfileId: string;

  @IsUUID()
  vehicleTypeId: string;

  @IsString()
  @MaxLength(50)
  make: string;

  @IsString()
  @MaxLength(50)
  model: string;

  @IsInt()
  year: number;

  @IsString()
  @MaxLength(15)
  plateNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @IsOptional()
  @IsDateString()
  inspectionDate?: Date;

  @IsOptional()
  @IsDateString()
  lastMaintenanceDate?: Date;

  @IsOptional()
  @IsInt()
  mileage?: number;
}
