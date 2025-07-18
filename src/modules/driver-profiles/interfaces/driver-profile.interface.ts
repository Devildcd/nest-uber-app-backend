export type BackgroundCheckStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 're_check_required';

export type OnboardingStatus =
  | 'registered'
  | 'documents_uploaded'
  | 'background_check_done'
  | 'approved'
  | 'rejected';

export interface IEmergencyContact {
  name: string;
  phoneNumber: string;
  relationship: string;
}

export interface IDriverProfile {
  id: string;
  userId: string;
  driverLicenseNumber: string;
  driverLicenseExpirationDate: Date;
  driverLicensePictureUrl?: string;
  backgroundCheckStatus: BackgroundCheckStatus;
  backgroundCheckDate?: Date;
  isApproved: boolean;
  onboardingStatus: OnboardingStatus;
  emergencyContactInfo?: IEmergencyContact;
  lastOnlineAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
