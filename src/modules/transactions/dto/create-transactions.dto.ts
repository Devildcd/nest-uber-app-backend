import {
  IsEnum,
  IsUUID,
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsObject,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType, TransactionStatus } from '../entities/transaction.entity';

export class CreateTransactionDto {
  @ApiProperty({
    description: 'Tipo de la transacción.',
    enum: TransactionType,
    example: TransactionType.CHARGE,
  })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({
    description: 'Monto bruto de la transacción (antes de fees).',
    example: 100.5,
  })
  @Type(() => Number)
  @IsNumber()
  grossAmount: number;

  @ApiPropertyOptional({
    description: 'Monto retenido por la plataforma (fees).',
    example: 20.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  platformFeeAmount?: number;

  @ApiProperty({
    description: 'Monto neto que será acreditado/debitado (gross - fees).',
    example: 80.0,
  })
  @Type(() => Number)
  @IsNumber()
  netAmount: number;

  @ApiPropertyOptional({
    description: 'Código de moneda (ISO 4217).',
    example: 'CUP',
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Estado inicial de la transacción.',
    enum: TransactionStatus,
    example: TransactionStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({
    description: 'UUID de la orden asociada (si aplica).',
    example: 'a3f1c2d4-5678-90ab-cdef-1234567890ab',
  })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({
    description: 'UUID del viaje asociado (si aplica).',
    example: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
  })
  @IsOptional()
  @IsUUID()
  tripId?: string;

  @ApiPropertyOptional({
    description: 'Usuario origen (debitador) - UUID (si aplica).',
    example: '11111111-2222-3333-4444-555555555555',
  })
  @IsOptional()
  @IsUUID()
  fromUserId?: string;

  @ApiPropertyOptional({
    description: 'Usuario destino (acreedor) - UUID (si aplica).',
    example: '66666666-7777-8888-9999-000000000000',
  })
  @IsOptional()
  @IsUUID()
  toUserId?: string;

  @ApiPropertyOptional({
    description: 'Fecha/tiempo en que se procesó (si aplica).',
    example: '2025-08-10T15:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  processedAt?: string;

  @ApiPropertyOptional({
    description: 'Descripción legible para auditoría interna.',
    example: 'Charge for trip #1234',
  })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  description?: string;

  @ApiPropertyOptional({
    description: 'Metadatos libres (respuesta de pasarela, logs, etc.)',
    type: Object,
    example: { gateway: 'stripe', intentId: 'pi_123456', raw: { /* ... */ } },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

