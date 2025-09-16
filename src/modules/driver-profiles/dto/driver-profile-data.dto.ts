import { Expose, Type } from 'class-transformer';
import {
  BackgroundCheckStatus,
  DriverStatus,
} from '../entities/driver-profile.entity';

export class UserDto {
  @Expose()
  name: string;

  @Expose()
  phoneNumber?: string;

  @Expose()
  email?: string;
}

export class EmergencyContactDto {
  @Expose()
  name: string;

  @Expose()
  phoneNumber: string;

  @Expose()
  relationship: string;
}

export class DriverProfileDataDto {
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
