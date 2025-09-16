// src/modules/drivers/dto/driver-availability.response.dto.ts
import { Expose, Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AvailabilityReason } from '../entities/driver-availability.entity';

export class LatLngResponseDto {
  @ApiProperty({ example: -12.0464, description: 'Latitud (WGS84)' })
  lat!: number;

  @ApiProperty({ example: -77.0428, description: 'Longitud (WGS84)' })
  lng!: number;
}

const toIso = (v: any) => (v instanceof Date ? v.toISOString() : (v ?? null));

export class DriverAvailabilityResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  driverId!: string;

  @ApiProperty()
  @Expose()
  isOnline!: boolean;

  @ApiProperty()
  @Expose()
  isAvailableForTrips!: boolean;

  @ApiPropertyOptional({ type: () => LatLngResponseDto, nullable: true })
  @Expose()
  @Type(() => LatLngResponseDto)
  @Transform(
    ({ value, obj }) => {
      // Admite: {lat,lng} o GeoJSON Point { type:'Point', coordinates:[lng,lat] }
      const src = value ?? obj.lastLocation ?? obj['last_location'];
      if (!src) return null;

      if (typeof src.lat === 'number' && typeof src.lng === 'number') {
        return { lat: src.lat, lng: src.lng };
      }
      if (
        src?.type === 'Point' &&
        Array.isArray(src.coordinates) &&
        src.coordinates.length >= 2
      ) {
        const [lng, lat] = src.coordinates;
        if (typeof lat === 'number' && typeof lng === 'number') {
          return { lat, lng };
        }
      }
      return null;
    },
    { toPlainOnly: true },
  )
  lastLocation!: LatLngResponseDto | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @Expose()
  @Transform(({ value }) => toIso(value), { toPlainOnly: true })
  lastLocationTimestamp!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  currentTripId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Expose()
  currentVehicleId!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @Expose()
  @Transform(({ value }) => toIso(value), { toPlainOnly: true })
  lastOnlineTimestamp!: string | null;

  @ApiPropertyOptional({ enum: AvailabilityReason, nullable: true })
  @Expose()
  availabilityReason!: AvailabilityReason | null;

  @ApiProperty({ format: 'date-time' })
  @Expose()
  @Transform(({ value }) => toIso(value), { toPlainOnly: true })
  updatedAt!: string;

  @ApiPropertyOptional({
    format: 'date-time',
    nullable: true,
    description: 'Soft delete',
  })
  @Expose()
  @Transform(({ value }) => toIso(value), { toPlainOnly: true })
  deletedAt!: string | null;
}
