import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsUrl } from 'class-validator';

export class PurchasePrepaidPlanCashDto {
  @ApiProperty({ description: 'Plan a comprar', format: 'uuid' })
  @IsUUID()
  planId!: string;

  @ApiProperty({ description: 'Usuario que compra (conductor o pasajero)', format: 'uuid' })
  @IsUUID()
  buyerUserId!: string;

  @ApiProperty({ description: 'Punto de recaudo donde se formaliza el depósito', format: 'uuid' })
  @IsUUID()
  collectionPointId!: string;

  @ApiProperty({ description: 'Usuario staff que recepciona en el punto de recaudo', format: 'uuid' })
  @IsUUID()
  collectedByUserId!: string;
  
}
