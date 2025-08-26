// src/modules/user/dto/user-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class UserResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Unique user identifier',
    example: '3cee82c1-8e0c-42ed-9e59-e8c545edce73',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Full name of the user',
    example: 'Carlos Martínez',
  })
  name: string;

  @Expose()
  @ApiProperty({
    description: 'Email address',
    example: 'carlos.martinez@example.com',
  })
  email?: string;

  @Expose()
  @ApiProperty({
    description: 'Has email been verified?',
    example: false,
  })
  emailVerified: boolean;

  @Expose()
  @ApiPropertyOptional({
    description: 'Phone number (if provided)',
    example: '+34123456789',
  })
  phoneNumber?: string;

  @Expose()
  @ApiProperty({
    description: 'Has phone number been verified?',
    example: false,
  })
  phoneNumberVerified: boolean;

  @Expose()
  @ApiProperty({
    description: 'Type of user',
    enum: ['passenger', 'driver', 'admin'],
    example: 'passenger',
  })
  userType: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'URL of profile picture',
    example: 'https://example.com/avatar.jpg',
  })
  profilePictureUrl?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Current geolocation',
    example: { latitude: 40.4168, longitude: -3.7038 },
  })
  currentLocation?: { latitude: number; longitude: number };

  @Expose()
  @ApiProperty({
    description: 'List of vehicle IDs owned by the user',
    type: [String],
    example: ['a1b2c3d4-e5f6-7a8b-9c0d-ef1234567890'],
  })
  vehicles: string[];

  @Expose()
  @ApiProperty({
    description: 'User account status',
    enum: ['active', 'inactive', 'banned'],
    example: 'active',
  })
  status: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Preferred language code',
    example: 'es',
  })
  preferredLanguage?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'ISO8601 timestamp when terms were accepted',
    example: '2025-06-20T14:30:00Z',
  })
  termsAcceptedAt?: Date;

  @Expose()
  @ApiPropertyOptional({
    description: 'ISO8601 timestamp when privacy policy was accepted',
    example: '2025-06-20T14:30:00Z',
  })
  privacyPolicyAcceptedAt?: Date;

  @Expose()
  @ApiProperty({
    description: 'ISO8601 timestamp when the user was created',
    example: '2025-06-24T15:40:22.992Z',
  })
  createdAt: Date;

  @Expose()
  @ApiPropertyOptional({
    description: 'ISO8601 timestamp when the user was soft-deleted',
    example: '2025-06-25T08:00:00Z',
  })
  deletedAt?: Date;
}
