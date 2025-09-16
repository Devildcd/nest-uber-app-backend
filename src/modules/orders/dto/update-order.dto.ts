import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsString,
  IsObject,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus } from '../entities/order.entity';

export class UpdateOrderDto {
  @ApiPropertyOptional({ description: 'Estado actualizado', enum: OrderStatus })
  @IsOptional()
  @IsString()
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'Monto solicitado' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  requestedAmount?: number;

  @ApiPropertyOptional({ description: 'paymentIntentId' })
  @IsOptional()
  @IsString()
  paymentIntentId?: string;

  @ApiPropertyOptional({ description: 'paymentGatewayResponse' })
  @IsOptional()
  @IsObject()
  paymentGatewayResponse?: Record<string, any>;

  @ApiPropertyOptional({ description: 'paymentMethodDetails' })
  @IsOptional()
  @IsObject()
  paymentMethodDetails?: Record<string, any>;

  @ApiPropertyOptional({ description: 'failureReason' })
  @IsOptional()
  @IsString()
  failureReason?: string;

  // Permitir reasignar trip o passenger si tu negocio lo admite:
  @ApiPropertyOptional({ description: 'Reasignar trip (uuid)' })
  @IsOptional()
  @IsUUID()
  tripId?: string;

  @ApiPropertyOptional({ description: 'Reasignar passenger (uuid)' })
  @IsOptional()
  @IsUUID()
  passengerId?: string;

  @ApiPropertyOptional({ description: 'Reasignar driver (uuid)' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsUUID()
  confirmedBy: string; // quién confirma (ej. driver_id o admin)

  @IsOptional()
  @IsString()
  note?: string;
}
