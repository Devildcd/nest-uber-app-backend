import {
  IsNumber,
  IsOptional,
  IsString,
  isUUID,
  IsUUID,
  Min,
} from 'class-validator';

export class NormalRefundDto {
  @IsUUID()
  adminId: string;

  @IsUUID()
  collectionPointId: string;

  @IsOptional()
  @IsString()
  reason?: string;

  /**
   * Partial refund amount (decimal). If omitted -> full refund.
   * Accept as number in request body (e.g. { "amount": 10.50 }).
   */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
