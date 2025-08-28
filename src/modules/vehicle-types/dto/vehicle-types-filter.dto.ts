import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class VehicleTypeFilterDto {
  @ApiPropertyOptional({
    description:
      'Filtrar por coincidencia parcial del nombre del tipo de vehículo',
    example: 'SUV',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado activo/inactivo',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar por categoría de vehículo (ID)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de clase de servicio',
    example: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true }) // Validar que cada elemento del array sea un UUID v4
  serviceClassIds?: string[];

  @ApiPropertyOptional({
    description: 'Filtrar por capacidad mínima de pasajeros',
    example: 4,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minCapacity?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por capacidad máxima de pasajeros',
    example: 7,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxCapacity?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por tarifa base mínima',
    example: 2.5,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minBaseFare?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por tarifa base máxima',
    example: 10.0,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxBaseFare?: number;
}
