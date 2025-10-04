import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsString,
  IsIn,
  IsDateString,
  IsNumberString,
} from 'class-validator';

export class WalletMovementQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por driverId' })
  @IsOptional()
  @IsUUID('4')
  driverId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por walletId (driver_balance.id)',
  })
  @IsOptional()
  @IsUUID('4')
  walletId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por transactionId exacto' })
  @IsOptional()
  @IsUUID('4')
  transactionId?: string;

  @ApiPropertyOptional({ description: 'Fecha desde (inclusive) - ISO 8601' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (inclusive) - ISO 8601' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Búsqueda en note (ILIKE)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Monto mínimo' })
  @IsOptional()
  @IsNumberString()
  amountMin?: string;

  @ApiPropertyOptional({ description: 'Monto máximo' })
  @IsOptional()
  @IsNumberString()
  amountMax?: string;

  @ApiPropertyOptional({
    description: 'Columna de orden',
    enum: ['createdAt', 'amount'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'amount'])
  sortBy?: 'createdAt' | 'amount';

  @ApiPropertyOptional({
    description: 'Dirección de orden',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
