import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../entities/order.entity';

export class OrderFiltersDto {
  @ApiPropertyOptional({ description: 'Filtro por estado', enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Filtrar por pasajero (id)' })
  @IsOptional()
  @IsUUID()
  passengerId?: string;

  @ApiPropertyOptional({ description: 'Monto mínimo' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minAmount?: number;

  @ApiPropertyOptional({ description: 'Monto máximo' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxAmount?: number;

  @ApiPropertyOptional({ description: 'Rango fecha inicio (ISO string)' })
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Rango fecha fin (ISO string)' })
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Búsqueda libre: parte de id o email/nombre pasajero',
  })
  @IsOptional()
  search?: string;
}
