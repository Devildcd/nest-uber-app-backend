import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { VehicleStatus, Vehicle } from '../entities/vehicle.entity';

export class VehicleResponseDto {
  @Expose()
  @ApiProperty({ example: 'c1a4d29a-2a7f-4b20-9f3f-6d1a3df2d5e9' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'Toyota' })
  make: string;

  @Expose()
  @ApiProperty({ example: 'Corolla' })
  model: string;

  @Expose()
  @ApiProperty({ example: 2021 })
  year: number;

  @Expose()
  @ApiProperty({ example: 'ABC123' })
  plateNumber: string;

  @Expose()
  @ApiPropertyOptional({ example: 'Rojo' })
  color?: string;

  @Expose()
  @ApiProperty({ example: 4 })
  capacity: number;

  @Expose()
  @ApiProperty({ example: true })
  isActive: boolean;

  @Expose()
  @ApiProperty({ enum: VehicleStatus, example: VehicleStatus.APPROVED })
  status: VehicleStatus;

  @Expose()
  @Transform(({ obj }: any) => obj.driver?.id ?? obj.driverId)
  @ApiProperty({ example: 'uuid-driver' })
  driverId: string;

  @Expose()
  @Transform(({ obj }: any) => obj.driverProfile?.id ?? obj.driverProfileId)
  @ApiProperty({ example: 'uuid-driver-profile' })
  driverProfileId: string;

  @Expose()
  @Transform(({ obj }: any) => obj.vehicleType?.id ?? obj.vehicleTypeId)
  @ApiProperty({ example: 'uuid-vehicle-type' })
  vehicleTypeId: string;

  @Expose()
  @Transform(({ obj }: any) => (obj.inspectionDate ? obj.inspectionDate.toISOString() : undefined))
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  inspectionDate?: string;

  @Expose()
  @Transform(({ obj }: any) => (obj.lastMaintenanceDate ? obj.lastMaintenanceDate.toISOString() : undefined))
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  lastMaintenanceDate?: string;

  @Expose()
  @ApiPropertyOptional({ example: 45000 })
  mileage?: number;
  
  @Expose()
  @Transform(({ obj }: any) => (obj.createdAt ? obj.createdAt.toISOString() : undefined))
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @Expose()
  @Transform(({ obj }: any) => (obj.updatedAt ? obj.updatedAt.toISOString() : undefined))
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: string;

  @Expose()
  @Transform(({ obj }: any) => (obj.deletedAt ? obj.deletedAt.toISOString() : undefined))
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  deletedAt?: string;
}
