import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsInt,
  Min,
  IsNotEmpty,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';

export class CreateVehicleTypeDto {
  @ApiProperty({
    description:
      'ID de la categoría general a la que pertenece este tipo de vehículo',
    example: 'b7a9c9d6-3f28-4e9a-bf82-91f0a8f1a234',
  })
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    description:
      'Lista de IDs de las clases de servicio a la que pertenece este tipo de vehículo',
    example: [
      'e6b15a89-3c42-45b8-8d12-84c9c0f22d91',
      'a1b2c3d4-5678-90ab-cdef-1234567890ab',
    ],
    type: [String],
  })
  @IsUUID('4', { each: true }) // Validar que cada elemento sea un UUID v4
  @ArrayMinSize(1)
  serviceClassIds: string[];

  @ApiProperty({
    description: 'Nombre específico del tipo de vehículo',
    example: 'SUV Compacto',
    maxLength: 100,
  })
  @IsNotEmpty()
  @MaxLength(100)
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Descripción detallada del tipo de vehículo',
    example: 'Un SUV de tamaño compacto con capacidad para 5 pasajeros',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Tarifa base inicial',
    example: 3.5,
    default: 1.0,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  baseFare: number = 1.0;

  @ApiProperty({
    description: 'Costo por kilómetro',
    example: 1.25,
    default: 1.0,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  costPerKm: number = 1.0;

  @ApiProperty({
    description: 'Costo por minuto de espera',
    example: 0.35,
    default: 1.0,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  costPerMinute: number = 1.0;

  @ApiProperty({
    description: 'Tarifa mínima garantizada',
    example: 5.0,
    default: 1.0,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  minFare: number = 1.0;

  @ApiProperty({
    description: 'Capacidad de pasajeros por defecto',
    example: 4,
  })
  @IsInt()
  @Min(1)
  defaultCapacity: number;

  @ApiProperty({
    description: 'URL del icono representativo',
    example: 'https://cdn.app.com/icons/suv.png',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  iconUrl?: string;

  @ApiProperty({
    description: 'Indica si este tipo de vehículo está activo',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
