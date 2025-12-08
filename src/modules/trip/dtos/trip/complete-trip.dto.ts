import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CompleteTripDto {
  @IsUUID()
  driverId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualDistanceKm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualDurationMin?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  extraFees?: number | null;

  // ⬇️ NUEVO: minutos de espera totales
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  waitingTimeMinutes?: number | null;

  // ⬇️ NUEVO: motivo / texto de la penalización
  @IsOptional()
  @IsString()
  @MaxLength(500)
  waitingReason?: string | null;
}
