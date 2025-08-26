// src/modules/user/dto/create-user.dto.ts

import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  Length,
  IsEmail,
  IsUrl,
  ValidateNested,
  IsObject,
  IsNumber,
  IsUUID,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserType, UserStatus } from '../entities/user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class LocationDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}

export class CreateUserDto {
  @ApiProperty({ description: 'Full name', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Email address',
    format: 'email',
    maxLength: 150,
  })
  @ValidateIf((o: CreateUserDto) => !o.phoneNumber)
  @IsEmail()
  @Length(5, 150)
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+34123456789' })
  @ValidateIf((o: CreateUserDto) => !o.email)
  @IsString()
  @Length(10, 20)
  phoneNumber?: string;

  @ApiPropertyOptional({ enum: UserStatus, description: 'User status' })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiProperty({ enum: UserType, description: 'Type of user' })
  @IsEnum(UserType)
  userType: UserType;

  @ApiPropertyOptional({ description: 'URL of profile picture', format: 'url' })
  @IsOptional()
  @IsUrl()
  profilePictureUrl?: string;

  @ApiPropertyOptional({ type: LocationDto, description: 'Current location' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  currentLocation?: LocationDto;

  @ApiPropertyOptional({ description: 'Assigned vehicle ID', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Preferred language', example: 'es' })
  @IsOptional()
  @IsString()
  @Length(2, 10)
  preferredLanguage?: string;

  @ApiPropertyOptional({
    description: 'When terms were accepted (ISO8601)',
    example: '2025-06-20T14:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  termsAcceptedAt?: string;

  @ApiPropertyOptional({
    description: 'When privacy policy was accepted (ISO8601)',
    example: '2025-06-20T14:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  privacyPolicyAcceptedAt?: string;
}
