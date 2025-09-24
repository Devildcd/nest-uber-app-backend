import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TripEventCreateItemDto } from './trip-event-create-item.dto';

export class TripEventBulkCreateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tripId: string;

  @ApiProperty({ type: [TripEventCreateItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TripEventCreateItemDto)
  events: TripEventCreateItemDto[];
}
