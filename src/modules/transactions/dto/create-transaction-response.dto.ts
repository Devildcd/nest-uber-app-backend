import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { TransactionDataDto } from './transaction-data.dto';

export class CreateTransactionResponseDto {
  @ApiProperty({
    description: 'Indica si la operación fue exitosa',
    example: true,
  })
  @Expose()
  success: boolean;

  @ApiProperty({
    description: 'Mensaje describiendo el resultado',
    example: 'Transaction created successfully',
  })
  @Expose()
  message: string;

  @ApiPropertyOptional({
    description: 'Detalle de la transacción creada',
    type: () => TransactionDataDto,
  })
  @Expose()
  @Type(() => TransactionDataDto)
  data?: TransactionDataDto;

  @ApiPropertyOptional({
    description: 'Información del error en caso de fallo',
    example: {
      code: 'CONFLICT_ERROR',
      details: 'Duplicate transaction reference',
    },
  })
  @Expose()
  error?: { code?: string; details?: any };
}
