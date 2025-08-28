import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateVehicleServiceClassDto {
  @ApiPropertyOptional({
    description: 'Nuevo nombre de la clase de servicio',
    example: 'Premium',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Nueva descripción',
    example: 'Vehículos de alta gama con mayor confort',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Multiplicador actualizado de tarifa base',
    example: 1.5,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  baseFareMultiplier?: number;

  @ApiPropertyOptional({
    description: 'Multiplicador actualizado para costo por km',
    example: 1.2,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  costPerKmMultiplier?: number;

  @ApiPropertyOptional({
    description: 'Multiplicador actualizado para costo por minuto',
    example: 1.1,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  costPerMinuteMultiplier?: number;

  @ApiPropertyOptional({
    description: 'Multiplicador actualizado para tarifa mínima',
    example: 1.05,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  minFareMultiplier?: number;

  @ApiPropertyOptional({
    description: 'Nueva capacidad mínima',
    example: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  minCapacity?: number;

  @ApiPropertyOptional({
    description: 'Nueva capacidad máxima',
    example: 7,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxCapacity?: number;

  @ApiPropertyOptional({
    description: 'URL actualizada del ícono',
    example: 'https://cdn.example.com/icons/premium.png',
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  iconUrl?: string;

  @ApiPropertyOptional({
    description: 'Nuevo orden en la UI',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  displayOrder?: number;

  @ApiPropertyOptional({
    description: 'Indica si la clase está activa',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
