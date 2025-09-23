// dto/wallet-movement.dto.ts
import { Expose, Transform } from 'class-transformer';
import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
} from 'class-validator';

/**
 * DTO de respuesta para un movimiento de wallet.
 * Normaliza valores numéricos y fecha.
 */
export class WalletMovementDto {
  @IsUUID()
  @Expose()
  id: string;

  @IsUUID()
  @Expose()
  walletId: string;

  @IsOptional()
  @IsUUID()
  @Expose()
  transactionId?: string | null;

  @IsNumber()
  @Transform(({ value }) => {
    const n =
      value === null || value === undefined
        ? 0
        : typeof value === 'string'
          ? Number(value)
          : value;
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  })
  @Expose()
  amount: number;

  @IsNumber()
  @Transform(({ value }) => {
    const n =
      value === null || value === undefined
        ? 0
        : typeof value === 'string'
          ? Number(value)
          : value;
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  })
  @Expose()
  previousBalance: number;

  @IsNumber()
  @Transform(({ value }) => {
    const n =
      value === null || value === undefined
        ? 0
        : typeof value === 'string'
          ? Number(value)
          : value;
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  })
  @Expose()
  newBalance: number;

  @IsOptional()
  @IsString()
  @Expose()
  note?: string;

  @IsDateString()
  @Expose()
  createdAt: string;
}
