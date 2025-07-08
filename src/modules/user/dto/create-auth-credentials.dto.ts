import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
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

  @ApiHideProperty()
  @ValidateIf((o: CreateAuthCredentialsDto) =>
    [AuthMethod.GOOGLE, AuthMethod.FACEBOOK, AuthMethod.APPLE].includes(
      o.authenticationMethod,
    ),
  )
  @ValidateNested()
  @Type(() => OAuthProvidersDto)
  oauthProviders?: OAuthProvidersDto;

  @ApiHideProperty()
  @IsOptional()
  @IsString()
  @Length(TOKEN_MIN_LENGTH, TOKEN_MAX_LENGTH)
  passwordResetToken?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString()
  passwordResetTokenExpiresAt?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsBoolean()
  mfaEnabled?: boolean;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString()
  lastPasswordChangeAt?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsInt()
  @Min(0)
  failedLoginAttempts?: number;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString()
  lockoutUntil?: string;

  @ApiHideProperty()
  @IsOptional()
  @IsDateString()
  lastLoginAt?: string;

  // @ApiHideProperty()
  // @ValidateIf((o: CreateAuthCredentialsDto) => !!o.mfaEnabled)
  // @IsString()
  // mfaSecret?: string;

  // @ApiHideProperty()
  // @IsOptional()
  // @IsString()
  // @Length(TOKEN_MIN_LENGTH, TOKEN_MAX_LENGTH)
  // emailVerificationToken?: string;

  // @ApiHideProperty()
  // @IsOptional()
  // @IsDateString()
  // emailVerificationTokenExpiresAt?: string;

  // @ApiHideProperty()
  // @IsOptional()
  // @IsString()
  // @Length(TOKEN_MIN_LENGTH, TOKEN_MAX_LENGTH)
  // phoneVerificationToken?: string;

  // @ApiHideProperty()
  // @IsOptional()
  // @IsDateString()
  // phoneVerificationTokenExpiresAt?: string;
}
