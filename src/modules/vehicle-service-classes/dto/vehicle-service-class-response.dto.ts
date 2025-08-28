import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class VehicleServiceClassResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Identificador único de la clase de servicio de vehículo',
    example: 'a3f1c2d4-5678-90ab-cdef-1234567890ab',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Nombre único de la clase de servicio de vehículo',
    example: 'Economy',
    maxLength: 100,
  })
  name: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Descripción detallada de la clase de servicio',
    example: 'La opción más económica para viajes diarios',
  })
  description?: string;

  @Expose()
  @ApiProperty({
    description: 'Factor multiplicador aplicado a la tarifa base',
    example: 1.2,
    default: 1.0,
  })
  baseFareMultiplier: number;

  @Expose()
  @ApiProperty({
    description: 'Multiplicador para el costo por kilómetro',
    example: 1.1,
    default: 1.0,
  })
  costPerKmMultiplier: number;

  @Expose()
  @ApiProperty({
    description: 'Multiplicador para el costo por minuto',
    example: 1.1,
    default: 1.0,
  })
  costPerMinuteMultiplier: number;

  @Expose()
  @ApiProperty({
    description: 'Multiplicador para la tarifa mínima',
    example: 1.1,
    default: 1.0,
  })
  minFareMultiplier: number;

  @Expose()
  @ApiProperty({
    description: 'Capacidad mínima de pasajeros',
    example: 2,
    minimum: 1,
  })
  minCapacity: number;

  @Expose()
  @ApiProperty({
    description: 'Capacidad máxima de pasajeros',
    example: 6,
    minimum: 1,
  })
  maxCapacity: number;

  @Expose()
  @ApiPropertyOptional({
    description: 'URL del ícono representativo',
    example: 'https://cdn.example.com/icons/suv.png',
    maxLength: 255,
  })
  iconUrl?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Orden de visualización en la UI',
    example: 1,
    default: 1,
  })
  displayOrder?: number;

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
