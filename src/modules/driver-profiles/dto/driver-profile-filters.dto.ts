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
  OnboardingStatus,
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

  @IsOptional()
  @IsEnum(OnboardingStatus)
  onboardingStatus?: OnboardingStatus;
}
