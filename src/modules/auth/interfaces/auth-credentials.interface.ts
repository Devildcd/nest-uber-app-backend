export type AuthMethod = 'local' | 'google' | 'facebook' | 'apple';

export interface IOAuthProviders {
  googleId?: string;
  facebookId?: string;
  appleId?: string;
}

export interface IAuthCredentials {
  id: string;
  userId: string;
  passwordHash?: string;
  salt?: string;
  authenticationMethod: AuthMethod;
  oauthProviders?: IOAuthProviders;
  passwordResetToken?: string;
  passwordResetTokenExpiresAt?: Date;
  mfaEnabled: boolean;
  mfaSecret?: string;
  lastPasswordChange?: Date;
  failedLoginAttempts: number;
  lockoutUntil?: Date;
  lastLoginAt: Date;
  emailVerificationToken?: string;
  emailVerificationTokenExpiresAt?: Date;
  phoneVerificationToken?: string;
  phoneVerificationTokenExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
