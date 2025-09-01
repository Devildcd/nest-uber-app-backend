import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  isNotEmpty,
} from 'class-validator';

export class CreateVehicleServiceClassDto {
  @ApiProperty({
    description: 'Nombre único de la clase de servicio',
    example: 'Economy',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Descripción detallada de la clase de servicio',
    example: 'La opción más económica para viajes diarios',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Factor multiplicador aplicado a la tarifa base',
    example: 1.2,
    default: 1.0,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  baseFareMultiplier: number = 1.0;

  @ApiProperty({
    description: 'Multiplicador para el costo por kilómetro',
    example: 1.1,
    default: 1.0,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  costPerKmMultiplier: number = 1.0;

  @ApiProperty({
    description: 'Multiplicador para el costo por minuto',
    example: 1.05,
    default: 1.0,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  costPerMinuteMultiplier: number = 1.0;

  @ApiProperty({
    description: 'Multiplicador para la tarifa mínima',
    example: 1.0,
    default: 1.0,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  minFareMultiplier: number = 1.0;

  @ApiProperty({
    description: 'Capacidad mínima de pasajeros',
    example: 2,
  })
  @IsInt()
  @Min(1)
  minCapacity: number;

  @ApiProperty({
    description: 'Capacidad máxima de pasajeros',
    example: 6,
  })
  @IsInt()
  @Min(1)
  maxCapacity: number;

  @ApiPropertyOptional({
    description: 'URL del ícono representativo',
    example: 'https://cdn.example.com/icons/economy.png',
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  iconUrl?: string;

  @ApiPropertyOptional({
    description: 'Orden de visualización en la UI',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  displayOrder?: number = 1;

  @ApiPropertyOptional({
    description: 'Indica si la clase de servicio está activa',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive: boolean = true;
}
