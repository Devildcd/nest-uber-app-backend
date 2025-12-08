import {
  IsNumber,
  IsOptional,
  IsISO8601,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class DriverAvailabilityPingDto {
  /** opcional: si no vienen lat/lng, es heartbeat puro */
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  /** precisión aproximada en metros (opcional, informativa) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracyMeters?: number;

  /** timestamp del dispositivo, opcional */
  @IsOptional()
  @IsISO8601()
  reportedAt?: string;

  /** si el cliente quiere forzar guardado (debug), no usar en prod por defecto */
  @IsOptional()
  @IsBoolean()
  forceSave?: boolean;
}
