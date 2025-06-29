import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { UserStatus, UserType } from '../entities/user.entity';

export class UserFiltersDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}
