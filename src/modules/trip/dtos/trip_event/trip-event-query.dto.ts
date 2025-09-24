import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsArray,
  ArrayNotEmpty,
  IsEnum,
  IsInt,
  Min,
  IsDateString,
  IsString,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TripEventType } from '../../interfaces/trip-event-types.enum';

export class TripEventQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtrar por trip' })
  @IsOptional()
  @IsUUID()
  tripId?: string;

  @ApiPropertyOptional({
    type: [TripEventType],
    enum: TripEventType,
    isArray: true,
    enumName: 'TripEventType',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(TripEventType, { each: true })
  types?: TripEventType[];

  @ApiPropertyOptional({ example: '2025-09-18T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-09-19T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Filtro simple por metadata key = value',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  metaKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 300)
  metaValue?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
