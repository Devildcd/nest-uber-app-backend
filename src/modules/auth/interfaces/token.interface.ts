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
