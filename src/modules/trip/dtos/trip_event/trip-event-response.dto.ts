import { ApiProperty } from '@nestjs/swagger';
import { TripEventType } from '../../interfaces/trip-event-types.enum';

export class TripEventResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() tripId: string;
  @ApiProperty({ enum: TripEventType }) eventType: TripEventType;
  @ApiProperty({ type: Object }) metadata: Record<string, any> | null;
  @ApiProperty() occurredAt: string; // ISO
  @ApiProperty() createdAt: string; // ISO (si lo manejas en entidad)
}
