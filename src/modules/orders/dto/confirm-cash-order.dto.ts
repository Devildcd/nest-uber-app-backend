import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ConfirmCashOrderDto {
  @ApiProperty({
    description: 'UUID del usuario que confirma el cobro (staff/operador)',
    example: '7a0532d5-6b93-4eab-9b3d-6c2203e1f0d2',
  })
  @IsUUID('4')
  confirmedByUserId: string;

  @ApiProperty({
    description:
      'Monto de la comisión a debitar al driver (decimal positivo, 2 decimales)',
    example: '25.50',
  })
  @IsNotEmpty()
  @IsNumberString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  commissionAmount: string;

  @ApiPropertyOptional({
    description:
      'Moneda ISO 4217 (3 letras). Debe coincidir con el wallet del driver',
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
      'Bruto del viaje (para KPI). Si se envía, se suma a totalEarnedFromTrips',
    example: '120.00',
  })
  @IsOptional()
  @IsNumberString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  grossAmount?: string;

  @ApiPropertyOptional({
    description: 'Nota para la comisión',
    example: 'cash trip commission',
    default: 'cash trip commission',
  })
  @IsOptional()
  @IsString()
  note?: string = 'cash trip commission';
}
