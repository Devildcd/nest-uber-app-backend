import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { GeoPointDto } from 'src/common/dto/geo-point.dto';

export class CreateDriverAvailabilityDto {
  @IsUUID()
  driverId!: string;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailableForTrips?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  lastLocation?: GeoPointDto;

  @IsOptional()
  @IsDateString()
  lastLocationTimestamp?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  currentTripId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  currentVehicleId?: string | null;

  @IsOptional()
  @IsDateString()
  lastOnlineTimestamp?: string;
}
