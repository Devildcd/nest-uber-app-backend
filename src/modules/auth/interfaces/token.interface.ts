import { SessionType } from '../entities/session.entity';

export interface TokenPayload {
  sub: string | number;
  [key: string]: unknown;
}

export interface RefreshTokenPayload extends TokenPayload {
  jti: string;
}

export interface SignedToken {
  token: string;
  expiresIn: number; // milliseconds
}

export interface RefreshToken extends SignedToken {
  jti: string;
}

export type RefreshTokensResult = {
  accessToken: string;
  refreshToken?: string; // solo para mobile (cuando no se usan cookies)
  accessTokenExpiresAt: number; // epoch ms
  refreshTokenExpiresAt: number; // epoch ms
  sid: string; // jti
  sessionType: SessionType;
};
