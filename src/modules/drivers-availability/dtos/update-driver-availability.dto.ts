import { Transform, Type } from 'class-transformer';
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
import { toBool } from 'src/common/transformers/bool.transform';
import { AvailabilityReason } from '../entities/driver-availability.entity';

export class UpdateDriverAvailabilityDto {
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @ValidateIf((_, v) => v === true || v === false)
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @ValidateIf((_, v) => v === true || v === false)
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
  @Transform(({ value }) => (value === 'null' ? null : value))
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  currentTripId?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === 'null' ? null : value))
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  currentVehicleId?: string | null;

  @IsOptional()
  @IsDateString()
  lastOnlineTimestamp?: string;
}
