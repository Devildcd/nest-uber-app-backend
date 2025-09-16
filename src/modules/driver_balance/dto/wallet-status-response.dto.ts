import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class WalletStatusResponseDto {
  @Expose()
  @ApiProperty({ example: '3a0c239d-7a63-43b2-a9b3-25b0f3a7a2cd' })
  driverId: string;

  @Expose()
  @ApiProperty({ example: 'active', enum: ['active', 'blocked'] })
  previousStatus: 'active' | 'blocked';

  @Expose()
  @ApiProperty({ example: 'blocked', enum: ['active', 'blocked'] })
  status: 'active' | 'blocked';

  @Expose()
  @ApiProperty({
    example: true,
    description: 'Indica si hubo cambio de estado',
  })
  changed: boolean;

  @Expose()
  @ApiProperty({ example: '2025-09-14T10:00:00.000Z' })
  changedAt: Date;
}
