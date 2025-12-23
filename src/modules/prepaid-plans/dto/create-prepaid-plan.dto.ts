import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreatePrepaidPlanDto {
  @ApiProperty({ example: 'Pack 10 viajes -10%' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Incluye 10 viajes con 10% de descuento' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Cantidad de viajes incluidos (NULL si no aplica)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  tripsIncluded?: number;

  @ApiPropertyOptional({
    example: '10.00',
    description: 'Porcentaje de descuento (0-100), decimal con 2 dígitos',
  })
  @IsOptional()
  @Matches(/^\d{1,3}(\.\d{1,2})?$/) // 0..100.00 (validación simple)
  discountPct?: string;

  @ApiPropertyOptional({
    example: '5.00',
    description: 'Descuento fijo en moneda',
  })
  @IsOptional()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  fixedDiscountAmount?: string;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  expiresInDays?: number;

  @ApiProperty({ example: '100.00' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  price!: string;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @IsNotEmpty()
  currency!: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({
    example: { tier: 'standard', perks: ['priority-support'] },
  })
  @IsOptional()
  @IsObject()
  planFeatures?: Record<string, any>;
}
