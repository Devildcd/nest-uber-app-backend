import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class VehicleTypeDataDto {
  @ApiProperty({
    description: 'ID único del tipo de vehículo',
    example: '6b1caa54-92c3-4e12-889a-3137f6c7e2f3',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Nombre del tipo de vehículo',
    example: 'SUV Compacto',
  })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'Descripción detallada',
    example: 'Un SUV de tamaño compacto con 5 asientos',
    required: false,
  })
  @Expose()
  description?: string;

  @ApiProperty({ description: 'Tarifa base', example: 3.5 })
  @Expose()
  baseFare: number;

  @ApiProperty({ description: 'Costo por km', example: 1.25 })
  @Expose()
  costPerKm: number;

  @ApiProperty({ description: 'Costo por minuto', example: 0.35 })
  @Expose()
  costPerMinute: number;

  @ApiProperty({ description: 'Tarifa mínima', example: 5.0 })
  @Expose()
  minFare: number;

  @ApiProperty({ description: 'Capacidad de pasajeros', example: 4 })
  @Expose()
  defaultCapacity: number;

  @ApiProperty({
    description: 'URL del ícono',
    example: 'https://cdn.app.com/icons/suv.png',
    required: false,
  })
  @Expose()
  iconUrl?: string;

  @ApiProperty({ description: 'Indica si está activo', example: true })
  @Expose()
  isActive: boolean;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2025-08-19T15:30:00.000Z',
  })
  @Expose()
  createdAt: string;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2025-08-19T16:45:00.000Z',
  })
  @Expose()
  updatedAt: string;

  @ApiProperty({
    description: 'Fecha de eliminación (si aplica)',
    example: null,
    required: false,
  })
  @Expose()
  deletedAt?: string;
}
