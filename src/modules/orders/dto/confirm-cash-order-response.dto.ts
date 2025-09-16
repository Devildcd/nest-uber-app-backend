import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PaymentType } from '../entities/order.entity';

export class ConfirmCashOrderResponseDto {
  @ApiProperty() orderId: string;
  @ApiProperty() tripId: string;
  @ApiProperty() driverId: string;
  @ApiProperty() passengerId: string;

  @ApiProperty({ enum: PaymentType, example: PaymentType.CASH })
  paymentType: PaymentType;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PAID })
  status: OrderStatus;

  @ApiProperty({ example: '2025-09-16T12:34:56.000Z' })
  paidAt: string;

  @ApiProperty({ example: '7a0532d5-6b93-4eab-9b3d-6c2203e1f0d2' })
  confirmedBy: string;

  @ApiProperty({ example: '25.50' })
  commissionAmount: string;

  @ApiProperty({ example: 'CUP' })
  currency: string;

  @ApiProperty({
    example: '3e6cf6b3-0a2f-4c1a-9f7a-5d5b5a8e9b45',
    description: 'ID de la transacción de comisión (PLATFORM_COMMISSION)',
  })
  commissionTransactionId: string;

  @ApiProperty({
    example: 'f12a6f63-78a7-4a77-9950-27d3d8b3b6ce',
    description: 'ID del movimiento de wallet',
  })
  walletMovementId: string;

  @ApiProperty({ example: '-15.00' })
  previousBalance: string;

  @ApiProperty({ example: '-40.50' })
  newBalance: string;

  @ApiProperty({
    example: false,
    description: 'true si la orden ya estaba paga (idempotente)',
  })
  alreadyPaid: boolean;
}
