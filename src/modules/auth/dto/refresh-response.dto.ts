import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshResponseDto {
  @ApiProperty({ description: 'New access token' })
  @Expose()
  accessToken: string;

  @ApiProperty({
    description: 'New refresh token (only for non‑web clients)',
    required: false,
  })
  @Expose()
  refreshToken?: string;
}
