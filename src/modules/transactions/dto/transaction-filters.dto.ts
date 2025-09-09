// src/modules/transactions/dto/transaction-filters.dto.ts
import { IsOptional, IsEnum, IsUUID, IsString, IsDateString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType, TransactionStatus } from '../entities/transaction.entity';

export class TransactionFiltersDto {
  @ApiPropertyOptional({
    description: 'Filtrar por tipo de transacción',
    enum: TransactionType,
    example: TransactionType.CHARGE,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({
    description: 'Filtrar por estado de la transacción',
    enum: TransactionStatus,
    example: TransactionStatus.PROCESSED,
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por usuario origen (UUID)',
    example: '11111111-2222-3333-4444-555555555555',
  })
  @IsOptional()
  @IsUUID()
  fromUserId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por usuario destino (UUID)',
    example: '66666666-7777-8888-9999-000000000000',
  })
  @IsOptional()
  @IsUUID()
  toUserId?: string;

  @ApiPropertyOptional({
    description: 'Fecha inicial (ISO) para rango de creación',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha final (ISO) para rango de creación',
    example: '2025-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Monto bruto mínimo (filtrado numérico)',
    example: 5.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minAmount?: number;

  @ApiPropertyOptional({
    description: 'Monto bruto máximo (filtrado numérico)',
    example: 1000.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAmount?: number;

  @ApiPropertyOptional({
    description: 'Búsqueda libre por fragmento de id o nombre/email de usuario',
    example: 'abc123 or john.doe@example.com',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
