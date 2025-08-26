import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateVehicleCategoryDto {
  @ApiPropertyOptional({
    description: 'Nuevo nombre de la categoría de vehículo',
    example: 'Sedán Deportivo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Descripción opcional de la categoría',
    example: 'Vehículos de tipo sedán deportivo de 4 puertas',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'URL al ícono representativo',
    example: 'https://cdn.example.com/icons/sedan.png',
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  iconUrl?: string;

  @ApiPropertyOptional({
    description: 'Indica si la categoría está activa',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
