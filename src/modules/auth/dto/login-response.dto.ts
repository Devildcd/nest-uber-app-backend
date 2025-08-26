import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { SessionType } from '../entities/session.entity';

export class LoginResponseDto {
  @ApiProperty({ description: 'Access Token JWT' })
  @IsString()
  @Expose()
  accessToken: string;

  @ApiProperty({
    description:
      'Refresh Token JWT (devuelto sólo en API/móvil, en web se envía por cookie)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Expose()
  refreshToken?: string;
  @ApiProperty({
    description: 'Tipo de sesión (web, mobile_app, api_client)',
    enum: ['web', 'mobile_app', 'api_client'],
  })
  @IsString()
  @Expose()
  sessionType: SessionType;
  @ApiProperty({
    description: 'Access token expiry timestamp in milliseconds since epoch',
    example: Date.now() + 15 * 60 * 1000,
  })
  @IsNumber()
  @Expose()
  accessTokenExpiresAt!: number;

  @Expose()
  sid!: string;

  @ApiProperty({
    description: 'Refresh token expiry timestamp in milliseconds since epoch',
    example: Date.now() + 7 * 24 * 60 * 60 * 1000,
  })
  @IsNumber()
  @Expose()
  refreshTokenExpiresAt!: number;
}
