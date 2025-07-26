import { Expose, Type } from 'class-transformer';
import {
  BackgroundCheckStatus,
  DriverStatus,
  OnboardingStatus,
} from '../entities/driver-profile.entity';
import { UserDto } from './driver-profile-data.dto';

/**
 * DTO que representa un item de la lista de driver profiles
 */
export class EmergencyContactDto {
  @Expose()
  name: string;

  @Expose()
  phoneNumber: string;

  @Expose()
  relationship: string;
}

export class DriverProfileListItemDto {
  @Expose()
  id: string;

  @Expose()
  @Type(() => UserDto)
  user: UserDto;

  @Expose()
  driverLicenseNumber: string;

  @Expose()
  driverLicenseExpirationDate: Date;

  @Expose()
  driverLicensePictureUrl?: string;

  @Expose()
  backgroundCheckStatus: BackgroundCheckStatus;

  @Expose()
  backgroundCheckDate?: Date;

  @Expose()
  isApproved: boolean;

  @Expose()
  onboardingStatus: OnboardingStatus;

  @Expose()
  @Type(() => EmergencyContactDto)
  emergencyContactInfo?: EmergencyContactDto;

  @Expose()
  driverStatus: DriverStatus;

  @Expose()
  paidPriorityUntil?: Date;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  deletedAt?: Date;
}
