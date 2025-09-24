import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { TripEventType } from '../../interfaces/trip-event-types.enum';

export class TripEventCreateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tripId: string;

  @ApiProperty({ enum: TripEventType })
  @IsEnum(TripEventType)
  eventType: TripEventType;

  @ApiPropertyOptional({ description: 'Payload contextual (JSON libre)' })
  @IsOptional()
  @Type(() => Object)
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ example: '2025-09-18T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string; // si no viene, server usa now()
}
