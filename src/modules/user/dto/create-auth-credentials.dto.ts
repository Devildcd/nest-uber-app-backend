import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
  ValidateNested,
  IsInt,
  Min,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthMethod } from '../entities/auth-credentials.entity';

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const TOKEN_MIN_LENGTH = 20;
const TOKEN_MAX_LENGTH = 200;

export class OAuthProvidersDto {
  @ApiPropertyOptional({
    description: 'Google OAuth provider ID',
    example: 'google-12345',
  })
  @IsOptional()
  @IsString()
  googleId?: string;

  @ApiPropertyOptional({
    description: 'Facebook OAuth provider ID',
    example: 'fb-12345',
  })
  @IsOptional()
  @IsString()
  facebookId?: string;

  @ApiPropertyOptional({
    description: 'Apple OAuth provider ID',
    example: 'apple-12345',
  })
  @IsOptional()
  @IsString()
  appleId?: string;
}

export class CreateAuthCredentialsDto {
  @ApiProperty({ description: 'User UUID', example: 'uuid-of-user' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: `Raw password for local authentication (min ${PASSWORD_MIN_LENGTH} chars)`, // stored as hash+salt
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    example: 'P@ssw0rd!23',
  })
  @ValidateIf(
    (o: CreateAuthCredentialsDto) =>
      o.authenticationMethod === AuthMethod.LOCAL,
  )
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  password?: string;

  @ApiProperty({
    enum: AuthMethod,
    description: 'Authentication method',
    example: AuthMethod.LOCAL,
  })
  @IsEnum(AuthMethod)
  authenticationMethod: AuthMethod;

  @ApiPropertyOptional({
    type: OAuthProvidersDto,
    description: 'Identifiers for OAuth providers',
  })
  @ValidateIf((o: CreateAuthCredentialsDto) =>
    [AuthMethod.GOOGLE, AuthMethod.FACEBOOK, AuthMethod.APPLE].includes(
      o.authenticationMethod,
    ),
  )
  @ValidateNested()
  @Type(() => OAuthProvidersDto)
  oauthProviders?: OAuthProvidersDto;

  @ApiPropertyOptional({
    description: `Password reset token (min ${TOKEN_MIN_LENGTH} chars)`,
    minLength: TOKEN_MIN_LENGTH,
    maxLength: TOKEN_MAX_LENGTH,
    example: 'reset-token-123',
  })
  @IsOptional()
  @IsString()
  @Length(TOKEN_MIN_LENGTH, TOKEN_MAX_LENGTH)
  passwordResetToken?: string;

  @ApiPropertyOptional({
    description: 'Expiration for password reset token (ISO8601)',
    example: '2025-07-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  passwordResetTokenExpiresAt?: string;

  @ApiPropertyOptional({
    description: 'Enable multi-factor authentication',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  mfaEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Secret used for MFA (TOTP)',
    example: 'JBSWY3DPEHPK3PXP',
  })
  @ValidateIf((o: CreateAuthCredentialsDto) => !!o.mfaEnabled)
  @IsString()
  mfaSecret?: string;

  @ApiPropertyOptional({
    description: 'Date of last password change (ISO8601)',
    example: '2025-06-01T12:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  lastPasswordChangeAt?: string;

  @ApiPropertyOptional({
    description: 'Count of consecutive failed login attempts',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  failedLoginAttempts?: number;

  @ApiPropertyOptional({
    description: 'Account lockout until date (ISO8601)',
    example: '2025-06-22T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  lockoutUntil?: string;

  @ApiPropertyOptional({
    description: 'Last login timestamp (ISO8601)',
    example: '2025-06-20T10:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  lastLoginAt?: string;

  @ApiPropertyOptional({
    description: `Email verification token (min ${TOKEN_MIN_LENGTH} chars)`,
    minLength: TOKEN_MIN_LENGTH,
    maxLength: TOKEN_MAX_LENGTH,
    example: 'email-verif-token-123',
  })
  @IsOptional()
  @IsString()
  @Length(TOKEN_MIN_LENGTH, TOKEN_MAX_LENGTH)
  emailVerificationToken?: string;

  @ApiPropertyOptional({
    description: 'Expiration for email verification token (ISO8601)',
    example: '2025-06-25T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  emailVerificationTokenExpiresAt?: string;

  @ApiPropertyOptional({
    description: `Phone verification token (min ${TOKEN_MIN_LENGTH} chars)`,
    minLength: TOKEN_MIN_LENGTH,
    maxLength: TOKEN_MAX_LENGTH,
    example: 'phone-verif-token-123',
  })
  @IsOptional()
  @IsString()
  @Length(TOKEN_MIN_LENGTH, TOKEN_MAX_LENGTH)
  phoneVerificationToken?: string;

  @ApiPropertyOptional({
    description: 'Expiration for phone verification token (ISO8601)',
    example: '2025-06-25T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  phoneVerificationTokenExpiresAt?: string;
}
