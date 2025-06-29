import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class UserListItemDto {
  @Expose()
  @ApiProperty({ example: 'c165d99b-77fb-493c-a33e-f7ccd7f1a2b8' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'María López' })
  name: string;

  @Expose()
  @ApiProperty({ example: 'maria.lopez@example.com' })
  email: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'URL of profile picture',
    example: 'https://example.com/avatar.jpg',
  })
  profilePictureUrl?: string;

  @Expose()
  @ApiProperty({ example: 'passenger', enum: ['passenger', 'driver', 'admin'] })
  userType: string;

  @Expose()
  @ApiProperty({ example: 'active', enum: ['active', 'inactive', 'banned'] })
  status: string;

  @Expose()
  @ApiPropertyOptional({ example: '+34123456789' })
  phoneNumber?: string;

  @Expose()
  @ApiProperty({ example: '2025-06-20T14:30:00Z' })
  createdAt: Date;
}
