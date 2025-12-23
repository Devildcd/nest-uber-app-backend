// src/modules/prepaid-plans/dto/user-active-prepaid-plan-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class UserActivePrepaidPlanResponseDto {
  @Expose()
  @ApiProperty({
    description: 'ID de la instancia del plan del usuario',
    example: '3e8b3b2a-3d4a-4a4e-98a4-0f8b0d1a2b3c',
  })
  userPrepaidPlanId!: string;

  @Expose()
  @ApiProperty({
    description: 'ID del usuario (owner del plan)',
    example: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  })
  userId!: string;

  @Expose()
  @ApiProperty({
    description: 'ID del plan del catálogo',
    example: '11111111-2222-3333-4444-555555555555',
  })
  planId!: string;

  @Expose()
  @ApiProperty({
    description: 'Nombre del plan',
    example: 'Pack 10 viajes -10%',
  })
  planName!: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Descripción del plan',
    example: 'Incluye 10 viajes con 10% de descuento',
    type: String,
  })
  planDescription?: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Viajes incluidos (si aplica)',
    example: 10,
    type: Number,
    nullable: true,
  })
  tripsIncluded?: number | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Porcentaje de descuento (si aplica)',
    example: '10.00',
    type: String,
    nullable: true,
  })
  discountPct?: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Monto de descuento fijo (si aplica)',
    example: '25.00',
    type: String,
    nullable: true,
  })
  fixedDiscountAmount?: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Vigencia en días del plan (si aplica)',
    example: 30,
    type: Number,
    nullable: true,
  })
  expiresInDays?: number | null;

  @Expose()
  @ApiProperty({
    description: 'Precio del plan',
    example: '1000.00',
    type: String,
  })
  price!: string;

  @Expose()
  @ApiProperty({ description: 'Moneda del plan', example: 'CUP' })
  currency!: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Atributos adicionales del plan',
    type: Object,
    nullable: true,
  })
  planFeatures?: Record<string, any> | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Viajes restantes (si aplica)',
    example: 7,
    type: Number,
    nullable: true,
  })
  tripsRemaining?: number | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Fecha de expiración (ISO 8601) si aplica',
    example: '2025-12-31T23:59:59.000Z',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  expirationDate?: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Liability estimada (si es pack con viajes)',
    example: '700.00',
    type: String,
    nullable: true,
  })
  liabilityEstimated?: string | null;
}
