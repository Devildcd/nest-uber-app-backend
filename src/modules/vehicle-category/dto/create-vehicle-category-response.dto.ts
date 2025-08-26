import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleCategoryDataDto } from './vehicle-category-data.dto';

export class CreateVehicleCategoryResponseDto {
  @ApiProperty({
    description: 'Indica si la operación fue exitosa',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Mensaje que describe el resultado de la operación',
    example: 'Vehicle category creada exitosamente',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Datos de la categoría creada',
    type: VehicleCategoryDataDto,
  })
  data?: VehicleCategoryDataDto;

  @ApiPropertyOptional({
    description: 'Información de error (en caso de failure)',
    example: {
      code: 'CONFLICT_ERROR',
      details: 'Key (name)=... already exists.',
    },
  })
  error?: {
    code?: string;
    details?: any;
  };
}
