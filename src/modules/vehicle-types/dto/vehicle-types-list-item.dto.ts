import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class VehicleTypeListItemDto {
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
  createdAt: Date;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2025-08-19T16:45:00.000Z',
  })
  @Expose()
  updatedAt: Date;

  @ApiProperty({
    description: 'Nombre de la categoría asociada',
    example: 'SUV',
    required: false,
  })
  @Expose()
  @Transform(({ obj }) => obj.category?.name || null)
  categoryName: string;

  @ApiProperty({
    description: 'ID de la categoría asociada',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: false,
  })
  @Expose()
  @Transform(({ obj }) => obj.category?.id || null)
  categoryId: string;

  @ApiProperty({
    description: 'Nombres de las clases de servicio asociadas',
    example: ['Premium', 'Económico'],
    type: [String],
    required: false,
  })
  @Expose()
  @Transform(
    ({ obj }) =>
      obj.serviceClasses?.map((serviceClass: any) => serviceClass.name) || [],
  )
  serviceClassNames: string[];

  @ApiProperty({
    description: 'IDs de las clases de servicio asociadas',
    example: [
      'b2c3d4e5-f6g7-8901-bcde-f23456789012',
      'c3d4e5f6-g7h8-9012-cdef-345678901234',
    ],
    type: [String],
    required: false,
  })
  @Expose()
  @Transform(
    ({ obj }) =>
      obj.serviceClasses?.map((serviceClass: any) => serviceClass.id) || [],
  )
  serviceClassIds: string[];
}
