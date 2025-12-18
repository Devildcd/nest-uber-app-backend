import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class PrepaidPlanResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Identificador único del plan prepago',
    example: '9b2f1d7c-1a2b-4c3d-9e8f-0123456789ab',
  })
  id!: string;

  @Expose()
  @ApiProperty({
    description: 'Nombre del plan',
    example: 'Pack 10 viajes -10%',
    maxLength: 255,
  })
  name!: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Descripción detallada del plan',
    example: 'Incluye 10 viajes con 10% de descuento',
  })
  description?: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Número de viajes incluidos en el plan (si aplica)',
    example: 10,
    minimum: 0,
    type: Number,
  })
  tripsIncluded?: number | null;

  @Expose()
  @ApiPropertyOptional({
    description:
      'Porcentaje de descuento (decimal con 2 dígitos). Se recomienda string para preservar precisión.',
    example: '10.00',
    type: String,
  })
  discountPct?: string | null;

  @Expose()
  @ApiPropertyOptional({
    description:
      'Monto de descuento fijo (numeric con 2 decimales). String para preservar precisión.',
    example: '5.00',
    type: String,
  })
  fixedDiscountAmount?: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: 'Días de vigencia del plan (si aplica)',
    example: 90,
    minimum: 1,
    type: Number,
  })
  expiresInDays?: number | null;

  @Expose()
  @ApiProperty({
    description:
      'Precio del plan para el usuario (numeric con 2 decimales). String para preservar precisión.',
    example: '100.00',
    type: String,
  })
  price!: string;

  @Expose()
  @ApiProperty({
    description: 'Moneda del precio del plan (código ISO 4217)',
    example: 'USD',
    maxLength: 10,
  })
  currency!: string;

  @Expose()
  @ApiProperty({
    description: 'Indica si el plan está disponible actualmente',
    example: true,
    type: Boolean,
  })
  isActive!: boolean;

  @Expose()
  @ApiPropertyOptional({
    description: 'Características adicionales del plan (JSON arbitrario)',
    example: { tier: 'standard', perks: ['priority-support'] },
    type: Object,
  })
  planFeatures?: Record<string, any> | null;

  @Expose()
  @ApiProperty({
    description: 'Fecha de creación del registro (ISO 8601)',
    example: '2025-08-10T14:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt!: string;

  @Expose()
  @ApiProperty({
    description: 'Fecha de última actualización del registro (ISO 8601)',
    example: '2025-08-12T10:15:00.000Z',
    type: String,
    format: 'date-time',
  })
  updatedAt!: string;
}
