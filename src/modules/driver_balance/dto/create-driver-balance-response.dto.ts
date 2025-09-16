import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DriverBalanceResponseDto } from './driver-balance-response.dto';
export class CreateDriverBalanceResponseDto {
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
    description: 'Datos del wallet creado',
    type: DriverBalanceResponseDto,
  })
  data?: DriverBalanceResponseDto;

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
