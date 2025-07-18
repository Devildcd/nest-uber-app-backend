import { Expose } from 'class-transformer';

export class DriverProfileDataDto {
  @Expose()
  id: string;

  @Expose()
  user: { id: string; email?: string };

  @Expose()
  driverLicenseNumber: string;

  @Expose()
  driverLicenseExpirationDate: Date;

  @Expose()
  driverLicensePictureUrl?: string;

  @Expose()
  backgroundCheckStatus: string;

  @Expose()
  backgroundCheckDate?: Date;

  @Expose()
  isApproved: boolean;

  @Expose()
  onboardingStatus: string;

  @Expose()
  emergencyContactInfo?: Record<string, unknown>;

  @Expose()
  lastOnlineAt?: Date;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
