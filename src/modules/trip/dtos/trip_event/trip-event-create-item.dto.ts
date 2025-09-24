// ítems sin tripId repetido
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { TripEventType } from '../../interfaces/trip-event-types.enum';

export class TripEventCreateItemDto {
  @ApiProperty({ enum: TripEventType })
  @IsEnum(TripEventType)
  eventType: TripEventType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Object)
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ example: '2025-09-18T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
