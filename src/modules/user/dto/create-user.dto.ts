import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  Length,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserType, UserStatus } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsEmail()
  @Length(5, 150)
  email: string;

  @IsOptional()
  @IsString()
  @Length(10, 20)
  phoneNumber?: string;

  @IsEnum(UserType)
  userType: UserType;

  @IsOptional()
  @IsString()
  profilePictureUrl?: string;

  @IsOptional()
  @Type(() => Object)
  readonly currentLocation?: { latitude: number; longitude: number };

  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @Length(2, 10)
  preferredLanguage?: string;

  @IsOptional()
  @IsDateString()
  termsAcceptedAt?: string;

  @IsOptional()
  @IsDateString()
  privacyPolicyAcceptedAt?: string;
}
