import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { AvailabilityReason } from '../entities/driver-availability.entity'; // ajusta import

export class UpdateDriverStatusDto {
  @IsOptional() @IsBoolean() isOnline?: boolean;
  @IsOptional() @IsBoolean() isAvailableForTrips?: boolean;
  @IsOptional()
  @IsEnum(AvailabilityReason)
  availabilityReason?: AvailabilityReason | null;
}
