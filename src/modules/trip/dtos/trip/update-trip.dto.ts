import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { PaymentMode } from '../../entities/trip.entity';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Patch mínimo para campos editables sin cambiar estado/timestamps.
 * (Si luego quieres exponer cambios de estado, haz DTOs específicos por transición).
 */
export class UpdateTripDto {
  @ApiPropertyOptional({ enum: PaymentMode })
  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @ApiPropertyOptional({ example: 'Lobby principal, puerta A' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  pickupAddress?: string;

  // Editables; si llegan undefined no se tocan. (Evita null para no “vaciar”)
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Nueva categoría de vehículo',
  })
  @IsOptional()
  @IsUUID()
  vehicleCategoryId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Nueva clase de servicio',
  })
  @IsOptional()
  @IsUUID()
  serviceClassId?: string;
}
