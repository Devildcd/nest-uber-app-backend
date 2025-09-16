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

export class CreateCashTopupDto {
  @ApiProperty({
    description: 'ID del punto de recaudo',
    example: '0c7f1042-8631-4dbb-9a21-4c73d1a7b9fa',
  })
  @IsUUID('4')
  collectionPointId!: string;

  @ApiProperty({
    description: 'ID del operador/staff que recibe el efectivo',
    example: '8a8f0f2a-7b2b-4d3a-9f6e-2f5a7d1e9b1c',
  })
  @IsUUID('4')
  collectedByUserId!: string;

  @ApiProperty({
    description: 'Importe del depósito (decimal positivo en string)',
    example: '150.00',
  })
  @IsNotEmpty()
  @IsNumberString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  amount!: string;

  @ApiPropertyOptional({
    description: 'Moneda ISO 4217 (3 letras)',
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
    description: 'Notas del CCR',
    example: 'Depósito en sucursal central',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Descripción para la transacción',
    example: 'cash topup at desk',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Metadata libre',
    example: { source: 'window-3' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
