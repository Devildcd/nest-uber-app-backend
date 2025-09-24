import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { GeoPointDto } from 'src/common/dto/geo-point.dto';
import { TripStopCreateDto } from './create-trip-stop.dto';

export class TripStopUpdateDto {
  /** Edita metadatos de una parada ya creada (NO cambia el trip). */
  @ApiPropertyOptional({ example: 'Puerta trasera' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  address?: string;

  @ApiPropertyOptional({ example: 'ChIJtcaxrqlZwokRfwmmibzPsTU' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  placeId?: string;

  @ApiPropertyOptional({
    type: GeoPointDto,
    description: 'Mover ligeramente la ubicación si hace falta',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  point?: GeoPointDto;

  @ApiPropertyOptional({
    example: 2,
    description: 'Reordenar secuencia; el server re-normaliza 1..N',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  seq?: number;

  @ApiPropertyOptional({ example: '2025-09-18T15:50:00Z' })
  @IsOptional()
  @IsDateString()
  plannedArrivalAt?: string;

  @ApiPropertyOptional({ example: '2025-09-18T15:55:12Z' })
  @IsOptional()
  @IsDateString()
  reachedAt?: string;

  @ApiPropertyOptional({ example: 'El pasajero bajó en este punto' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

/** Reemplazo de todas las paradas: útil si el cliente decide cambiar el itinerario completo antes de asignar. */
export class ReplaceTripStopsDto {
  @ApiProperty({ type: [TripStopCreateDto] })
  @ValidateNested({ each: true })
  @Type(() => TripStopCreateDto)
  stops: TripStopCreateDto[];
}
