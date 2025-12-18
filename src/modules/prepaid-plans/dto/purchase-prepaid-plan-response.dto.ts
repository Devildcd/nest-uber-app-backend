import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PurchasePrepaidPlanResponseDto {
  @ApiProperty({ description: 'ID del registro user_prepaid_plans' })
  userPrepaidPlanId!: string;

  @ApiProperty({ description: 'Plan del catálogo' })
  planId!: string;

  @ApiProperty({ description: 'Comprador (usuario)' })
  buyerUserId!: string;

  @ApiProperty({ description: 'Monto cobrado (string numeric 12,2)' })
  price!: string;

  @ApiProperty({ description: 'Moneda (ISO 4217)' })
  currency!: string;

  @ApiProperty({ description: 'Viajes restantes tras la compra', nullable: true, type: Number })
  tripsRemaining!: number | null;

  @ApiPropertyOptional({ description: 'Fecha de expiración (ISO)', type: String, format: 'date-time', nullable: true })
  expirationDate?: string | null;

  @ApiProperty({ description: 'Transacción contable asociada (transactions.id)' })
  transactionId!: string;

  @ApiProperty({ description: 'Liability estimada (price * tripsRemaining/tripsIncluded). Null si el plan no es pack.', nullable: true, type: String })
  liabilityEstimated?: string | null;
}
