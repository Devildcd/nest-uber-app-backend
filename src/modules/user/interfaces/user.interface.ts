import { ILocation } from './location.interface';

export type UserType = 'passenger' | 'driver' | 'admin';
export type UserStatus = 'active' | 'inactive' | 'banned';

export interface IUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phoneNumber?: string;
  phoneNumberVerified: boolean;
  userType: UserType;
  profilePictureUrl?: string;
  currentLocation?: ILocation;
  vehicleId?: string;
  status: UserStatus;
  preferredLanguage?: string;
  termsAcceptedAt?: Date;
  privacyPolicyAcceptedAt?: Date;
  createdAt: Date;
}
