import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType, TransactionStatus } from '../entities/transaction.entity';
import { Expose } from 'class-transformer';

export class TransactionListItemDto {
  @Expose()
  @ApiProperty({ description: 'Transaction id (UUID)', example: 'a3f1c2d4-5678-90ab-cdef-1234567890ab' })
  id: string;

  @Expose()
  @ApiProperty({ description: 'Tipo de transacción', enum: TransactionType, example: TransactionType.CHARGE })
  type: TransactionType;

  @Expose()
  @ApiProperty({ description: 'Monto bruto de la transacción', example: 12.5 })
  grossAmount: number;

  @Expose()
  @ApiProperty({ description: 'Monto neto resultante después de fees', example: 10.0 })
  netAmount: number;

  @Expose()
  @ApiPropertyOptional({ description: 'Monto retenido por la plataforma o fees', example: 2.5 })
  platformFeeAmount?: number;

  @Expose()
  @ApiProperty({ description: 'Código de moneda (ISO 4217)', example: 'CUP' })
  currency: string;

  @Expose()
  @ApiProperty({ description: 'Estado de la transacción', enum: TransactionStatus, example: TransactionStatus.PENDING })
  status: TransactionStatus;

  @Expose()
  @ApiPropertyOptional({ description: 'Usuario origen (id)', example: '11111111-2222-3333-4444-555555555555' })
  fromUserId?: string;

  @Expose()
  @ApiPropertyOptional({ description: 'Usuario destino (id)', example: '66666666-7777-8888-9999-000000000000' })
  toUserId?: string;

  @Expose()
  @ApiProperty({ description: 'Fecha de creación (ISO 8601)', example: '2025-08-10T14:30:00.000Z' })
  createdAt: string;

  @Expose()
  @ApiProperty({ description: 'Fecha de última actualización (ISO 8601)', example: '2025-08-10T15:00:00.000Z' })
  updatedAt: string;
}
