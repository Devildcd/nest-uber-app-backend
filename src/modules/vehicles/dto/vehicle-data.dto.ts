import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { VehicleStatus } from '../entities/vehicle.entity';

export class VehicleDataDto {
  @Expose()
  @ApiProperty({
    description: 'ID único del vehículo',
    example: 'f3e2d1c0-1234-5678-9abc-def012345678',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'ID del driver (UUID)',
    example: 'a1b2c3d4-1111-2222-3333-abcdef123456',
  })
  driverId: string;

  @Expose()
  @ApiProperty({
    description: 'ID del driver profile (UUID)',
    example: 'd4c3b2a1-4444-5555-6666-fedcba654321',
  })
  driverProfileId: string;

  @Expose()
  @ApiProperty({
    description: 'ID del vehicle type (UUID)',
    example: 'b7a8d6f4-1234-5678-90ab-cdef12345678',
  })
  vehicleTypeId: string;

  @Expose()
  @ApiProperty({ description: 'Marca', example: 'Toyota' })
  make: string;

  @Expose()
  @ApiProperty({ description: 'Modelo', example: 'Corolla' })
  model: string;

  @Expose()
  @ApiProperty({ description: 'Año de fabricación', example: 2020 })
  year: number;

  @Expose()
  @ApiProperty({ description: 'Número de placa', example: 'ABC1234' })
  plateNumber: string;

  @Expose()
  @ApiPropertyOptional({ description: 'Color', example: 'Blanco' })
  color?: string;

  @Expose()
  @ApiProperty({ description: 'Capacidad (nº pasajeros)', example: 4 })
  capacity: number;

  @Expose()
  @ApiProperty({ description: 'Indica si el vehículo está activo', example: true })
  isActive: boolean;

  @Expose()
  @ApiProperty({ description: 'Estado del vehículo', example: VehicleStatus.APPROVED, enum: VehicleStatus })
  status: VehicleStatus;

  @Expose()
  @ApiPropertyOptional({ description: 'Fecha de última inspección (ISO 8601)', example: '2025-08-19T12:34:56.000Z' })
  inspectionDate?: string;

  @Expose()
  @ApiPropertyOptional({ description: 'Fecha último mantenimiento (ISO 8601)', example: '2025-08-01T09:00:00.000Z' })
  lastMaintenanceDate?: string;

  @Expose()
  @ApiPropertyOptional({ description: 'Kilometraje (mileage)', example: 120000 })
  mileage?: number;

  @Expose()
  @ApiProperty({ description: 'Fecha de creación (ISO 8601)', example: '2025-08-19T12:34:56.000Z' })
  createdAt: string;

  @Expose()
  @ApiProperty({ description: 'Última actualización (ISO 8601)', example: '2025-08-20T08:00:00.000Z' })
  updatedAt: string;

  @Expose()
  @ApiPropertyOptional({ description: 'Fecha de eliminación (soft delete) si aplica', example: null })
  deletedAt?: string;
}
