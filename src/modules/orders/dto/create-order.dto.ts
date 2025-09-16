import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsObject,
  IsNotEmpty,
  IsNumberString,
  Length,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { OrderStatus } from '../entities/order.entity';

export class CreateOrderDto {
  @ApiProperty({ description: 'ID del viaje asociado', example: 'uuid-trip' })
  @IsUUID()
  tripId: string;

  @ApiProperty({
    description: 'ID del pasajero a cobrar',
    example: 'uuid-user',
  })
  @IsUUID()
  passengerId: string;

  @ApiProperty({
    description: 'UUID del driver',
    example: '8a8f0f2a-7b2b-4d3a-9f6e-2f5a7d1e9b1c',
  })
  @IsUUID('4')
  driverId: string;

  @ApiProperty({
    description:
      'Monto total solicitado de la orden (decimal positivo en string)',
    example: '120.00',
  })
  @IsNotEmpty()
  @IsNumberString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  requestedAmount: string;

  @ApiPropertyOptional({ description: 'Estado actualizado', enum: OrderStatus })
  @IsOptional()
  @IsString()
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'ID retornado por la pasarela de pagos (opcional)',
    example: 'pi_12345',
  })
  @IsOptional()
  @IsString()
  paymentIntentId?: string;

  @ApiPropertyOptional({
    description: 'Respuesta cruda de la pasarela (opcional)',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  paymentGatewayResponse?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Detalles anonimizados del método de pago (opcional)',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  paymentMethodDetails?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Razón de fallo (opcional)',
    example: 'card_declined',
  })
  @IsOptional()
  @IsString()
  failureReason?: string;

  @ApiPropertyOptional({
    description:
      'Moneda ISO 4217 (3 letras) — opcional si toda la plataforma es mono-moneda',
    example: 'CUP',
    default: 'CUP',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  currency?: string = 'CUP';
}
