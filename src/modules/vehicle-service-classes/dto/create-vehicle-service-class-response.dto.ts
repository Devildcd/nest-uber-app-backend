import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { VehicleServiceClassDataDto } from './vehicle-service-class-data.dto';

export class CreateVehicleServiceClassResponseDto {
  @ApiProperty({
    description: 'Indica si la operación fue exitosa',
    example: true,
  })
  @Expose()
  success: boolean;

  @ApiProperty({
    description: 'Mensaje que describe el resultado de la operación',
    example: 'Vehicle service class creada exitosamente',
  })
  @Expose()
  message: string;

  @ApiPropertyOptional({
    description: 'Datos de la categoría creada',
    type: VehicleServiceClassDataDto,
  })
  @Expose()
  data?: VehicleServiceClassDataDto;

  @ApiPropertyOptional({
    description: 'Información de error (en caso de failure)',
    example: {
      code: 'CONFLICT_ERROR',
      details: 'Key (name)=... already exists.',
    },
  })
  @Expose()
  error?: {
    code?: string;
    details?: any;
  };
}
