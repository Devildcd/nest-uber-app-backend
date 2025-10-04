import { SessionType } from 'src/modules/auth/entities/session.entity';
import { UserType } from 'src/modules/user/entities/user.entity';

export const AuthEvents = {
  UserLoggedIn: 'auth.user.logged_in',
  SessionRefreshed: 'auth.session.refreshed',
  SessionRevoked: 'auth.session.revoked',
} as const;

export type AuthEventName = (typeof AuthEvents)[keyof typeof AuthEvents];

export interface UserLoggedInEvent {
  userId: string;
  userType: UserType;
  sid: string; // jti
  sessionType: SessionType;
  at: string; // ISO
  deviceInfo?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionRefreshedEvent {
  userId: string;
  oldSid: string;
  newSid: string;
  at: string;
}

export interface SessionRevokedEvent {
  userId: string;
  sid: string;
  reason?: string;
  at: string;
}
