export type BackgroundCheckStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 're_check_required';

export type OnboardingStatus =
  | 'registered'
  | 'documents_uploaded'
  | 'background_check_done'
  | 'training_completed'
  | 'approved'
  | 'rejected';

export type DriverStatus =
  | 'active'
  | 'suspended'
  | 'on_vacation'
  | 'pending_docs'
  | 'deactivated';

/**
 * Información de contacto de emergencia para un driver
 */
export interface IEmergencyContact {
  name: string;
  phoneNumber: string;
  relationship: string;
}

/**
 * Representación del perfil de conductor según la entidad TypeORM
 */
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
  driverStatus: DriverStatus;
  paidPriorityUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
