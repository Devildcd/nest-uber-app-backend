import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class VehicleCategoryResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Identificador único de la categoría de vehículo',
    example: 'a3f1c2d4-5678-90ab-cdef-1234567890ab',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Nombre único de la categoría de vehículo',
    example: 'SUV',
    maxLength: 100,
  })
  name: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Descripción de la categoría de vehículo',
    example: 'Vehículo deportivo utilitario con capacidad para 5 pasajeros',
  })
  description?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'URL del ícono representativo',
    example: 'https://cdn.example.com/icons/suv.png',
    maxLength: 255,
  })
  iconUrl?: string;

  @Expose()
  @ApiProperty({
    description: 'Indica si la categoría está activa',
    example: true,
  })
  isActive: boolean;

  @Expose()
  @ApiProperty({
    description: 'Fecha de creación del registro (ISO 8601)',
    example: '2025-08-10T14:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt: string;

  @Expose()
  @ApiProperty({
    description: 'Fecha de última actualización del registro (ISO 8601)',
    example: '2025-08-12T10:15:00.000Z',
    type: String,
    format: 'date-time',
  })
  updatedAt: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Fecha de eliminación del registro (ISO 8601)',
    example: '2025-08-20T08:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  deletedAt?: string;
}
