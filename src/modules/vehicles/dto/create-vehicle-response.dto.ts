import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { VehicleDataDto } from './vehicle-data.dto';

export class CreateVehicleResponseDto {
  @ApiProperty({
    description: 'Indica si la operación fue exitosa',
    example: true,
  })
  @Expose()
  success: boolean;

  @ApiProperty({
    description: 'Mensaje describiendo el resultado',
    example: 'Vehicle created successfully',
  })
  @Expose()
  message: string;

  @ApiPropertyOptional({
    description: 'Datos del vehículo creado',
    type: () => VehicleDataDto,
  })
  @Expose()
  @Type(() => VehicleDataDto)
  data?: VehicleDataDto;

  @ApiPropertyOptional({
    description: 'Información del error en caso de fallo',
    example: { code: 'CONFLICT_ERROR', details: 'Plate number already exists' },
  })
  @Expose()
  error?: { code?: string; details?: any };
}
