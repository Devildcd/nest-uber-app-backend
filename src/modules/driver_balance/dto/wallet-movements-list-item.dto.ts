import { Expose, Transform } from 'class-transformer';
import {
  IsUUID,
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  IsIn,
} from 'class-validator';
import { _roundTo2 } from 'src/common/validators/decimal.transformer';

type MovementDirection = 'credit' | 'debit' | 'zero';

/**
 * DTO de ítem para listas de movimientos.
 * Más liviano que el detalle completo, pensado para listados/paginaciones.
 */
export class WalletMovementListItemDto {
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
  @Transform(({ value }) => _roundTo2(value))
  @Expose()
  amount: number;

  /** Dirección derivada del monto (credit/debit/zero) */
  @IsIn(['credit', 'debit', 'zero'])
  @Transform(({ obj }) => {
    const val = _roundTo2(obj?.amount);
    if (val > 0) return 'credit';
    if (val < 0) return 'debit';
    return 'zero';
  })
  @Expose()
  direction: MovementDirection;

  /** Balance posterior al movimiento (útil para mostrar “saldo después”) */
  @IsNumber()
  @Transform(({ value }) => _roundTo2(value))
  @Expose()
  newBalance: number;

  @IsOptional()
  @IsString()
  @Expose()
  note?: string;

  @IsDateString()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : new Date(value).toISOString(),
  )
  @Expose()
  createdAt: string;
}
