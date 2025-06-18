export type VehicleType = 'car' | 'motorcycle' | 'van' | 'suv' | 'other';
export type VehicleStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'maintenance'
  | 'unavailable';

export interface IVehicle {
  id: string;
  driverId: string;
  make: string;
  model: string;
  year: number;
  plateNumber: string;
  color?: string;
  vehicleType: VehicleType;
  capacity: number;
  licensePlateImageUrl?: string;
  registrationCardUrl?: string;
  insurancePolicyNumber?: string;
  insuranceExpiresAt?: Date;
  inspectionDate?: Date;
  isActive: boolean;
  status: VehicleStatus;
  createdAt: Date;
  updatedAt: Date;
}