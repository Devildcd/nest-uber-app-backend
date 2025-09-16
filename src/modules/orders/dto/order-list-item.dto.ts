import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { OrderStatus } from '../entities/order.entity';

export class OrderListItemDto {
  @Expose()
  @ApiProperty({ example: 'uuid-order' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'uuid-trip' })
  tripId: string;

  @Expose()
  @ApiProperty({ example: 'uuid-passenger' })
  passengerId: string;

  @Expose()
  @ApiProperty({ example: 12.5 })
  requestedAmount: number;

  @Expose()
  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @Expose()
  @ApiPropertyOptional({ example: '2025-08-10T12:00:00.000Z' })
  createdAt?: string;

  @Expose()
  @ApiPropertyOptional({ example: '2025-08-10T12:01:00.000Z' })
  updatedAt?: string;
}
