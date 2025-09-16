import {
  IsOptional,
  IsUUID,
  IsString,
  Length,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import {
  BackgroundCheckStatus,
  DriverStatus,
} from '../entities/driver-profile.entity';

export class DriverProfileFiltersDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  driverLicenseNumber?: string;

  @IsOptional()
  @IsEnum(BackgroundCheckStatus)
  backgroundCheckStatus?: BackgroundCheckStatus;

  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;

  // 👇 nuevo: filtrar por estado operativo del driver
  @IsOptional()
  @IsEnum(DriverStatus)
  driverStatus?: DriverStatus;
}
