// prepaid-plans/dto/purchase-prepaid-plan-wallet.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsUrl, IsString } from 'class-validator';

export class PurchasePrepaidPlanWalletDto {
  @ApiProperty({ description: 'Plan a comprar', format: 'uuid' })
  @IsUUID()
  planId!: string;

  @ApiProperty({ description: 'Usuario comprador (debe tener wallet de driver)', format: 'uuid' })
  @IsUUID()
  buyerUserId!: string;

  @ApiPropertyOptional({ description: 'Nota/observación' })
  @IsOptional()
  @IsString()
  note?: string;
 
}
