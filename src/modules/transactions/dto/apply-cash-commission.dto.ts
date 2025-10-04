import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  Length,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ApplyCashCommissionDto {
  @ApiProperty({
    description: 'Trip ID asociado a la comisión',
    example: 'd4ec6e4f-3f23-4a6f-8b7a-0fa6b2fb2222',
  })
  @IsUUID('4')
  tripId!: string;

  @ApiProperty({
    description: 'Order ID asociado a la comisión',
    example: 'd4ec6e4f-3f23-4a6f-8b7a-0fa6b2fb2222',
  })
  @IsUUID('4')
  orderId!: string;

  @ApiProperty({
    description: 'Monto de la comisión (decimal, 2 dígitos). Positivo.',
    example: '25.50',
  })
  @IsNotEmpty()
  @IsNumberString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  commissionAmount!: string;

  @ApiProperty({
    description: 'Tasa de comisión aplicada (decimal, 4 dígitos). Positiva.',
    example: '0.2',
  })
  @IsNotEmpty()
  @IsNumberString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  platformFeeAmount!: string;

  @ApiPropertyOptional({
    description:
      'Moneda ISO 4217 de 3 letras. Debe coincidir con la moneda del wallet.',
    example: 'CUP',
    default: 'CUP',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  currency?: string = 'CUP';

  @ApiPropertyOptional({
    description:
      'Monto bruto del viaje (opcional). Si se envía, se suma a totalEarnedFromTrips para KPI.',
    example: '120.00',
  })
  @IsOptional()
  @IsNumberString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  grossAmount?: string;

  @ApiPropertyOptional({
    description: 'Nota adicional para auditoría',
    example: 'cash trip commission',
    default: 'cash trip commission',
  })
  @IsOptional()
  @IsString()
  note?: string = 'cash trip commission';
}
