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

export class TripStopCreateDto {
  @ApiProperty({ type: GeoPointDto })
  @ValidateNested()
  @Type(() => GeoPointDto)
  point: GeoPointDto;

  @ApiPropertyOptional({ example: 'Av. Siempre Viva 742' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  address?: string;

  @ApiPropertyOptional({ example: 'ChIJtcaxrqlZwokRfwmmibzPsTU' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  placeId?: string;

  @ApiPropertyOptional({ example: 'Cliente baja paquete aquí' })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;

  /** Si quieres permitir que el cliente proponga el orden, opcional. El server puede ignorarlo y re-secuenciar. */
  @ApiPropertyOptional({
    example: 1,
    description: 'Orden deseado; el servidor reasigna 1..N',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  seq?: number;

  @ApiPropertyOptional({ example: '2025-09-18T15:45:00Z' })
  @IsOptional()
  @IsDateString()
  plannedArrivalAt?: string;
}
