import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class WalletSnapshotDto {
  @ApiProperty({
    description: 'Driver wallet balance before adjustment',
    example: 120.5,
    nullable: true,
  })
  @Expose()
  prevBalance: number | null;

  @ApiProperty({
    description: 'Driver wallet balance after adjustment',
    example: 130.5,
    nullable: true,
  })
  @Expose()
  newBalance: number | null;
}

export class CommissionAdjustmentResponseDto {
  @ApiProperty({
    description: 'UUID of the related order',
    example: 'c8f07a28-6f43-4e64-a7de-048f272f93ab',
  })
  @Expose()
  orderId: string;

  @ApiProperty({
    description: 'UUID of the commission adjustment',
    example: 'b5f6a1c0-9f3e-4e67-9a34-6c174c86e789',
  })
  @Expose()
  adjustmentId: string;

  @ApiProperty({
    description:
      'Sequential number of the adjustment for this order (idempotency key)',
    example: 1,
  })
  @Expose()
  adjustmentSeq: number;

  @ApiProperty({
    description: 'Delta applied to the commission fee',
    example: -5.25,
  })
  @Expose()
  deltaApplied?: number;

  @ApiProperty({
    description: 'Original commission fee before adjustment',
    example: 20.0,
  })
  @Expose()
  originalFee?: number;

  @ApiProperty({
    description: 'New commission fee after adjustment',
    example: 14.75,
  })
  @Expose()
  newFee?: number;

  @ApiProperty({
    description: 'Wallet balance snapshot (before and after adjustment)',
    type: WalletSnapshotDto,
    nullable: true,
  })
  @Type(() => WalletSnapshotDto)
  @Expose()
  wallet: WalletSnapshotDto | null;

  @ApiProperty({
    description: 'UUID of the created or reused transaction',
    example: '3b41f2f8-7e8d-44a9-a6df-5b44e8e8d21a',
    nullable: true,
  })
  @Expose()
  transactionId: string | null;

  @ApiProperty({
    description: 'UUID of the wallet movement associated with the adjustment',
    example: '8c3dfe7b-1245-42df-99b3-79f5d7f7a77e',
    nullable: true,
  })
  @Expose()
  movementId: string | null;

  @ApiProperty({
    description: 'Whether this adjustment already existed (idempotent replay)',
    example: true,
  })
  @Expose()
  alreadyExisted: boolean;

  @ApiProperty({
    description: 'Timestamp when the adjustment was created',
    example: '2025-09-20T12:34:56.000Z',
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the adjustment was last updated',
    example: '2025-09-20T12:34:56.000Z',
  })
  @Expose()
  updatedAt: Date;
}
