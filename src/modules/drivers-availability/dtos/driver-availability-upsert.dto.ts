import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GeoPointDto } from 'src/common/dto/geo-point.dto';

export class UpsertDriverAvailabilityDto {
  @IsUUID() driverId!: string;

  @IsOptional() @IsBoolean() isOnline?: boolean;
  @IsOptional() @IsBoolean() isAvailableForTrips?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  lastLocation?: GeoPointDto;

  @IsOptional()
  @IsString()
  lastLocationTimestamp?: string;

  @IsOptional()
  @IsString()
  lastOnlineTimestamp?: string;

  @IsOptional()
  @IsUUID()
  currentTripId?: string | null;

  @IsOptional()
  @IsUUID()
  currentVehicleId?: string | null;
}
