import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { OrderStatus, PaymentType } from '../entities/order.entity';

export class OrderDetailDto {
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
  @ApiProperty({ example: 'uuid-driver' })
  driverId: string;

  @Expose()
  @ApiProperty({ example: 12.5 })
  requestedAmount: number;

  @Expose()
  @ApiProperty({ enum: PaymentType })
  paymentType: PaymentType;

  @Expose()
  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @Expose()
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  paidAt?: string;

  @Expose()
  @ApiPropertyOptional({ example: 'uuid-driver' })
  confirmedBy?: string;

  @Expose()
  @ApiPropertyOptional({ example: 'pi_12345' })
  paymentIntentId?: string;

  @Expose()
  @ApiPropertyOptional({ type: Object })
  paymentGatewayResponse?: Record<string, any>;

  @Expose()
  @ApiPropertyOptional({ type: Object })
  paymentMethodDetails?: Record<string, any>;

  @Expose()
  @ApiPropertyOptional({ example: 'card_declined' })
  failureReason?: string;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: string;

  @Expose()
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  deletedAt?: string;
}
