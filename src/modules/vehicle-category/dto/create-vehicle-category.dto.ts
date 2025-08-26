import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  IsUrl,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleCategoryDataDto } from './vehicle-category-data.dto';

export class CreateVehicleCategoryDto {
  @ApiProperty({
    description: 'Nombre único de la categoría',
    example: 'Sedán',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({
    description: 'Descripción de la categoría',
    example: 'Vehículos de tipo sedán de 4 puertas',
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
