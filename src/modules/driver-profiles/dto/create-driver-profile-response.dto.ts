import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DriverProfileResponseDto } from './driver-profile-response.dto';

export class CreateDriverProfileResponseDto {
  @ApiProperty({
    description: 'Indica si la operación fue exitosa',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Mensaje que describe el resultado de la operación',
    example: 'Driver profile creado exitosamente',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Datos del driver profile creado',
    type: DriverProfileResponseDto,
  })
  data?: DriverProfileResponseDto;

  @ApiPropertyOptional({
    description: 'Información de error (en caso de failure)',
    example: {
      code: 'CONFLICT_ERROR',
      details: 'Key (user_id)=... already exists.',
    },
  })
  error?: {
    code?: string;
    details?: any;
  };
}
