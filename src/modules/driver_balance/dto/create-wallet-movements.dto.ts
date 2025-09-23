// dto/create-wallet-movement.dto.ts
import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO para crear un WalletMovement.
 * - amount puede ser positivo (crédito) o negativo (débito).
 * - previousBalance y newBalance son opcionales (el service puede calcularlos).
 */
export class CreateWalletMovementDto {
  @IsUUID()
  walletId: string;

  @IsOptional()
  @IsUUID()
  transactionId?: string | null;

  @IsNumber()
  @Transform(({ value }) => {
    const n =
      value === null || value === undefined
        ? 0
        : typeof value === 'string'
          ? Number(value)
          : value;
    // No forzamos signo; aceptamos negativos
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  })
  amount: number;

  // Opcional: si no se envía, el service debe calcular previousBalance/newBalance
  @IsOptional()
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
  previousBalance?: number;

  @IsOptional()
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
  newBalance?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
