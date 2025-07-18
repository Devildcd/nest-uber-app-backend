import {
  IsUUID,
  IsString,
  Length,
  IsDateString,
  IsOptional,
  IsUrl,
  IsEnum,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  BackgroundCheckStatus,
  OnboardingStatus,
} from '../entities/driver-profile.entity';

class EmergencyContactDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsString()
  @Length(7, 20)
  phoneNumber: string;

  @IsString()
  @Length(1, 50)
  relationship: string;
}

export class CreateDriverProfileDto {
  @IsUUID()
  userId: string;

  @IsString()
  @Length(1, 50)
  driverLicenseNumber: string;

  @IsDateString()
  driverLicenseExpirationDate: string;

  @IsOptional()
  @IsUrl()
  driverLicensePictureUrl?: string;

  @IsOptional()
  @IsEnum(BackgroundCheckStatus)
  backgroundCheckStatus?: BackgroundCheckStatus;

  @IsOptional()
  @IsDateString()
  backgroundCheckDate?: string;

  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;

  @IsOptional()
  @IsEnum(OnboardingStatus)
  onboardingStatus?: OnboardingStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  emergencyContactInfo?: EmergencyContactDto;

  @IsOptional()
  @IsDateString()
  lastOnlineAt?: string;
}
