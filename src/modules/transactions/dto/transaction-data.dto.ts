import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  TransactionStatus,
  TransactionType,
} from '../entities/transaction.entity';

export class TransactionDataDto {
  @ApiProperty({
    description: 'Identificador único de la transacción',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Tipo de transacción',
    enum: TransactionType,
    example: TransactionType.CHARGE,
  })
  @Expose()
  type: TransactionType;

  @ApiProperty({
    description: 'Monto bruto de la transacción',
    example: 25.5,
  })
  @Expose()
  grossAmount: number;

  @ApiProperty({
    description: 'Comisión de la plataforma aplicada a la transacción',
    example: 2.5,
  })
  @Expose()
  platformFeeAmount: number;

  @ApiProperty({
    description: 'Monto neto después de aplicar comisiones',
    example: 23.0,
  })
  @Expose()
  netAmount: number;

  @ApiProperty({
    description: 'Moneda en la que se registró la transacción',
    example: 'MN',
  })
  @Expose()
  currency: string;

  @ApiProperty({
    description: 'Estado de la transacción',
    enum: TransactionStatus,
    example: TransactionStatus.PROCESSED,
  })
  @Expose()
  status: TransactionStatus;

  @ApiPropertyOptional({
    description: 'Descripción o referencia de la transacción',
    example: 'Payment for trip #12345',
  })
  @Expose()
  description?: string;

  @ApiPropertyOptional({
    description: 'Datos adicionales en formato JSON',
    example: { paymentMethod: 'card', last4: '4242' },
  })
  @Expose()
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Fecha de creación de la transacción',
    example: '2025-09-09T10:20:30.000Z',
  })
  @Expose()
  createdAt: string;

  @ApiProperty({
    description: 'Fecha de última actualización de la transacción',
    example: '2025-09-09T11:00:00.000Z',
  })
  @Expose()
  updatedAt: string;

  @ApiPropertyOptional({
    description: 'Fecha en la que se procesó la transacción',
    example: '2025-09-09T10:25:00.000Z',
  })
  @Expose()
  processedAt?: string;
}
