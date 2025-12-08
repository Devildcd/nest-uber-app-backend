import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import {
  RefreshToken,
  SignedToken,
  TokenPayload,
} from '../interfaces/token.interface';

@Injectable()
export class TokenService {
  private readonly accessSignOptions: JwtSignOptions;
  private readonly refreshSignOptions: JwtSignOptions;
  private readonly verifyRefreshOptions: JwtVerifyOptions;
  private readonly verifyAccessOptions: JwtVerifyOptions;

  constructor(private readonly jwt: JwtService) {
    // Preconfigure sign/verify options from env
    this.accessSignOptions = {
      secret: process.env.JWT_ACCESS_SECRET as string,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN as string,
      issuer: process.env.JWT_ISSUER,
      // audience: process.env.JWT_AUDIENCE,
    };

    this.refreshSignOptions = {
      secret: process.env.JWT_REFRESH_SECRET as string,
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN as string,
      issuer: process.env.JWT_ISSUER,
      // audience: process.env.JWT_AUDIENCE,
    };

    this.verifyAccessOptions = {
      secret: this.accessSignOptions.secret,
      issuer: this.accessSignOptions.issuer,
      // audience: this.accessSignOptions.audience,
    };

    this.verifyRefreshOptions = {
      secret: this.refreshSignOptions.secret,
      issuer: this.refreshSignOptions.issuer,
      // audience: this.refreshSignOptions.audience,
    };
  }

  /**
   * Creates a new access token with given payload.
   */
  createAccessToken<T extends TokenPayload>(payload: T): SignedToken {
    try {
      const token = this.jwt.sign(payload, this.accessSignOptions);
      const expiresIn = this.calculateExpiresIn(token);
      return { token, expiresIn };
    } catch {
      throw new BadRequestException('Failed to create access token');
    }
  }

  /**
   * Creates a new refresh token with jti and returns its id.
   */
  createRefreshToken<T extends TokenPayload>(payload: T): RefreshToken {
    try {
      const jti = uuidv4();
      const signed = this.jwt.sign(
        { ...payload, jti },
        this.refreshSignOptions,
      );
      const expiresIn = this.calculateExpiresIn(signed);
      return { token: signed, jti, expiresIn };
    } catch {
      throw new BadRequestException('Failed to create refresh token');
    }
  }

  /**
   * Verifies an access token and returns its payload.
   */
  verifyAccessToken<T extends TokenPayload>(token: string): T {
    try {
      return this.jwt.verify<T>(token, this.verifyAccessOptions);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  /**
   * Verifies a refresh token, returns payload including jti.
   */
  verifyRefreshToken<T extends TokenPayload & { jti: string }>(
    token: string,
  ): T {
    try {
      return this.jwt.verify<T>(token, this.verifyRefreshOptions);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Decodes token without verifying signature (useful for exp extraction).
   */
  decodeToken<T = TokenPayload>(token: string): T {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const decoded = this.jwt.decode(token);
    if (!decoded || typeof decoded === 'string') {
      throw new BadRequestException('Failed to decode token');
    }
    return decoded as T;
  }

  /**
   * Calculates expiration time in ms based on token `exp` claim.
   */
  private calculateExpiresIn(token: string): number {
    const decoded = this.decodeToken<{ exp: number }>(token);
    const nowMs = Date.now();
    const expMs = decoded.exp * 1000;
    const ttl = expMs - nowMs;
    if (ttl <= 0) {
      throw new BadRequestException('Token already expired');
    }
    return ttl;
  }
}
