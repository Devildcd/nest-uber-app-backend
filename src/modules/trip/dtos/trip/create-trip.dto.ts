import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMode } from '../../entities/trip.entity';
import { GeoPointDto } from 'src/common/dto/geo-point.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TripStopCreateDto } from 'src/modules/trip/dtos/trip_stops/create-trip-stop.dto';

export class CreateTripDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  passengerId: string;

  @ApiProperty({ enum: PaymentMode })
  @IsEnum(PaymentMode)
  paymentMode: PaymentMode;

  @ApiProperty({ type: GeoPointDto })
  @ValidateNested()
  @Type(() => GeoPointDto)
  pickupPoint: GeoPointDto;

  @ApiPropertyOptional({ example: '350 5th Ave, New York, NY' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  pickupAddress?: string;

  /**
   * Paradas intermedias y/o destino (el servidor asignará secuencia 1..N).
   * Si no envías nada, el viaje queda sólo con pickup.
   */
  @ApiPropertyOptional({ type: [TripStopCreateDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TripStopCreateDto)
  stops?: TripStopCreateDto[];

  @ApiProperty({
    format: 'uuid',
    description: 'Categoría del vehículo (Auto, Moto, Van, …)',
  })
  @IsUUID()
  vehicleCategoryId: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Clase de servicio (Standard, Premium, …)',
  })
  @IsUUID()
  serviceClassId: string;

  @ApiPropertyOptional({
    description: 'Idempotency key para evitar duplicados',
  })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  idempotencyKey?: string;
}
