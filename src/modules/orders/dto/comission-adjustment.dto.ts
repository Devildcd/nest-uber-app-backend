import { Type } from 'class-transformer';
import {
  IsUUID,
  IsString,
  Length,
  IsOptional,
  IsNumber,
  ValidateIf,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Validator constraint: asegura que al menos deltaFee o newFee esté presente.
 * Se aplica a una propiedad (por ejemplo adjustmentSeq) pero valida el objeto completo.
 */
@ValidatorConstraint({ name: 'DeltaOrNewFeeProvided', async: false })
class DeltaOrNewFeeProvidedConstraint implements ValidatorConstraintInterface {
  validate(_: any, args: ValidationArguments) {
    const obj = args.object as any;
    return obj.deltaFee !== undefined || obj.newFee !== undefined;
  }

  defaultMessage(_: ValidationArguments) {
    return 'Either "deltaFee" or "newFee" must be provided.';
  }
}

/**
 * DTO para ajustar comisión post-facto.
 * - Provee dos rutas: deltaFee directo o newFee (se calcula delta = newFee - originalFee).
 * - Usa class-transformer para convertir strings -> numbers en payloads JSON o form-data.
 */
export class AdjustCommissionDto {
  @IsUUID()
  orderId!: string;

  // token/seq idempotencia (≤60 chars)
  @IsString()
  @Length(1, 60)
  @Validate(DeltaOrNewFeeProvidedConstraint) // validador que revisa el objeto completo
  adjustmentSeq!: string;

  /**
   * Opción A: delta directo (positivo = cobrar más al driver; negativo = devolver)
   * Validamos sólo si newFee no está presente.
   */
  @ValidateIf((o) => o.newFee === undefined)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'deltaFee must be a valid number' },
  )
  @Type(() => Number)
  @IsOptional()
  deltaFee?: number;

  /**
   * Opción B: nueva comisión total. Validamos sólo si deltaFee no está presente.
   */
  @ValidateIf((o) => o.deltaFee === undefined)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'newFee must be a valid number' },
  )
  @Type(() => Number)
  @IsOptional()
  newFee?: number;

  // Texto libre para auditoría
  @IsOptional()
  @IsString()
  reason?: string;

  // Umbral de seguridad (evita ajustes enormes por error). Valor no negativo.
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'maxAbsDeltaAllowed must be a valid number' },
  )
  @Type(() => Number)
  @Min(0, { message: 'maxAbsDeltaAllowed must be >= 0' })
  maxAbsDeltaAllowed?: number;
}
