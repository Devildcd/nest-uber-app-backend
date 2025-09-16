import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class DriverBalanceResponseDto {
  @Expose()
  @ApiProperty({ example: '8c9a9d43-4aab-4a6d-8c2a-b2e2a2e4e1c0' })
  id: string;

  @Expose()
  @ApiProperty({ example: '3a0c239d-7a63-43b2-a9b3-25b0f3a7a2cd' })
  driverId: string;

  @Expose()
  @ApiProperty({ example: 'active', enum: ['active', 'blocked'] })
  status: 'active' | 'blocked';

  @Expose()
  @ApiProperty({ example: 'CUP' })
  currency: string;

  @Expose()
  @ApiProperty({ example: '0.00', description: 'Saldo disponible actual' })
  currentWalletBalance: string | number;

  @Expose()
  @ApiProperty({
    example: '0.00',
    description: 'Saldo retenido (holds/disputas)',
  })
  heldWalletBalance: string | number;

  @Expose()
  @ApiProperty({
    example: '0.00',
    description: 'Total histórico ganado por viajes',
  })
  totalEarnedFromTrips: string | number;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  lastPayoutAt?: Date | null;

  @Expose()
  @ApiProperty({ example: '2025-09-14T10:00:00.000Z' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: '2025-09-14T10:00:00.000Z' })
  updatedAt: Date;
}
