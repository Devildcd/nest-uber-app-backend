import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { VehicleStatus, Vehicle } from '../entities/vehicle.entity';

export class VehicleListItemDto {
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
  @ApiProperty({ example: 2020 })
  year: number;

  @Expose()
  @ApiProperty({ example: 'ABC123' })
  plateNumber: string;

  @Expose()
  @ApiProperty({ example: 'Rojo', required: false })
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
  @ApiProperty({ example: 'uuid-driver' })
  @Transform(({ obj }: { obj: Vehicle }) => obj.driver?.id)
  driverId: string;

  @Expose()
  @ApiProperty({ example: 'uuid-driver-profile' })
  @Transform(({ obj }: { obj: Vehicle }) => obj.driverProfile?.id)
  driverProfileId: string;

  @Expose()
  @ApiProperty({ example: 'uuid-vehicle-type' })
  @Transform(({ obj }: { obj: Vehicle }) => obj.vehicleType?.id)
  vehicleTypeId: string;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}
