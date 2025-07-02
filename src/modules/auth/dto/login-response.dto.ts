import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

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
}
