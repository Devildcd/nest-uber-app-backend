import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CashCommissionResponseDto {
  @Expose()
  @ApiProperty({ example: '6a207bf0-6e4a-49d8-9a92-2e3b1e7d0a20' })
  transactionId: string;

  @Expose()
  @ApiProperty({ example: 'f9f0c4f7-9ac1-4b6b-b0a3-0a8b4d6dbe55' })
  walletMovementId: string;

  @Expose()
  @ApiProperty({ example: '3a0c239d-7a63-43b2-a9b3-25b0f3a7a2cd' })
  driverId: string;

  @Expose()
  @ApiProperty({ example: 'd4ec6e4f-3f23-4a6f-8b7a-0fa6b2fb2222' })
  tripId: string;

  @Expose()
  @ApiProperty({ example: 'CUP' })
  currency: string;

  @Expose()
  @ApiProperty({ example: '25.50' })
  commissionAmount: string;

  @Expose()
  @ApiProperty({ example: '0.00' })
  previousBalance: string;

  @Expose()
  @ApiProperty({ example: '-25.50' })
  newBalance: string;

  @Expose()
  @ApiProperty({
    example: '75.00',
    description: 'Total histórico ganado por viajes (si se envió grossAmount)',
  })
  totalEarnedFromTrips: string;
}
