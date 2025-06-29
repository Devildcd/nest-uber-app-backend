// src/common/utils/auth.utils.ts

import {
  Logger,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { sign, verify, JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import { TokenPair } from 'src/modules/auth/interfaces/token-pair.interface';

const logger = new Logger('AuthUtils');

/**
 * Generates a random bcrypt salt.
 * @param rounds number of salt rounds (default: 12)
 * @throws InternalServerErrorException if bcrypt.genSalt fails
 */
export async function generateSalt(rounds = 12): Promise<string> {
  try {
    return await bcrypt.genSalt(rounds);
  } catch (err) {
    logger.error('Error generating salt', err);
    throw new InternalServerErrorException('Failed to generate password salt');
  }
}

/**
 * Hashes a plaintext password using the provided salt.
 * @param password plaintext password
 * @param salt bcrypt salt
 * @throws InternalServerErrorException if bcrypt.hash fails
 */
export async function hashPassword(
  password: string,
  salt: string,
): Promise<string> {
  try {
    return await bcrypt.hash(password, salt);
  } catch (err) {
    logger.error('Error hashing password', err);
    throw new InternalServerErrorException('Failed to hash password');
  }
}

/**
 * Compares a plaintext password against its bcrypt hash.
 * @param password plaintext password
 * @param hashedPassword stored hash
 * @throws InternalServerErrorException if bcrypt.compare fails
 */
export async function comparePasswords(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (err) {
    logger.error('Error comparing passwords', err);
    throw new InternalServerErrorException('Failed to verify password');
  }
}

/**
 * Generates a pair of JWT tokens (access + refresh).
 * Reads secrets and expirations from process.env and validates them.
 * @param payload object to embed in JWT
 * @throws InternalServerErrorException if config is missing or sign fails
 */
export function generateTokenPair(payload: Record<string, any>): TokenPair {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  const accessExpire = process.env
    .JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'];
  const refreshExpire = process.env
    .JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'];

  if (!accessSecret || !refreshSecret || !accessExpire || !refreshExpire) {
    logger.error('Missing JWT configuration in environment');
    throw new InternalServerErrorException(
      'Server misconfiguration: JWT secrets or expirations are not set',
    );
  }

  try {
    const accessToken = sign(payload, accessSecret as Secret, {
      expiresIn: accessExpire,
    });
    const refreshToken = sign(payload, refreshSecret as Secret, {
      expiresIn: refreshExpire,
    });
    return { accessToken, refreshToken };
  } catch (err) {
    logger.error('Error generating JWT tokens', err);
    throw new InternalServerErrorException(
      'Failed to generate authentication tokens',
    );
  }
}

/**
 * Verifies and decodes a JWT.
 * @param token JWT string
 * @param isRefresh whether to use the refresh secret (default: false)
 * @throws UnauthorizedException if token is invalid or expired
 */
export function verifyToken<T = JwtPayload>(
  token: string,
  isRefresh = false,
): T {
  const secret = isRefresh
    ? process.env.JWT_REFRESH_SECRET
    : process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    logger.error('Missing JWT secret for verification');
    throw new InternalServerErrorException(
      'Server misconfiguration: JWT secret is not set',
    );
  }

  try {
    return verify(token, secret as Secret) as T;
  } catch (err: any) {
    logger.warn(`Invalid token: ${(err as Error).message}`);
    throw new UnauthorizedException('Invalid or expired token');
  }
}
