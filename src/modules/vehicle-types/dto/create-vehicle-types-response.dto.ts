import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { VehicleTypeResponseDto } from './vehicle-types-response.dto';

export class CreateVehicleTypeResponseDto {
  @ApiProperty({
    description: 'Indica si la operación fue exitosa',
    example: true,
  })
  @Expose()
  success: boolean;

  @ApiProperty({
    description: 'Mensaje que describe el resultado de la operación',
    example: 'Vehicle type creado exitosamente',
  })
  @Expose()
  message: string;

  @ApiPropertyOptional({
    description: 'Datos del tipo de vehículo creado',
    type: VehicleTypeResponseDto,
  })
  @Expose()
  data?: VehicleTypeResponseDto;

  @ApiPropertyOptional({
    description: 'Información de error (en caso de failure)',
    example: {
      code: 'CONFLICT_ERROR',
      details: 'Key (name)=Sedán already exists.',
    },
  })
  @Expose()
  error?: {
    code?: string;
    details?: any;
  };
}
