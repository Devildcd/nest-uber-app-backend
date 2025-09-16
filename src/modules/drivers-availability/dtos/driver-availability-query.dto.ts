import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { AvailabilityReason } from '../entities/driver-availability.entity';
import { toBool } from 'src/common/transformers/bool.transform';

export class DriverAvailabilityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  // Permitir filtrar por null: ?currentTripId=null
  @IsOptional()
  @Transform(({ value }) => (value === 'null' ? null : value))
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  currentTripId?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === 'null' ? null : value))
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  currentVehicleId?: string | null;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @ValidateIf((_, v) => v === true || v === false)
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @ValidateIf((_, v) => v === true || v === false)
  @IsBoolean()
  isAvailableForTrips?: boolean;

  // availabilityReason exacto (o null usando ?availabilityReason=null)
  @IsOptional()
  @Transform(({ value }) => (value === 'null' ? null : value))
  @ValidateIf((_, v) => v !== null)
  @IsEnum(AvailabilityReason)
  availabilityReason?: AvailabilityReason | null;

  // --- NUEVOS FLAGS DE FILTRO ---

  // Forzar reason IS NULL (estado elegible). Tiene prioridad sobre availabilityReason.
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @ValidateIf((_, v) => v === true || v === false)
  @IsBoolean()
  reasonIsNull?: boolean;

  // Matcheable de una (online + available + reason NULL).
  // applyFilters lo complementa con wallet/vehículo si no se piden explícitamente.
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @ValidateIf((_, v) => v === true || v === false)
  @IsBoolean()
  matchable?: boolean;

  // Exigir wallet activa (EXISTS driver_balance.status='active')
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @ValidateIf((_, v) => v === true || v === false)
  @IsBoolean()
  requireWalletActive?: boolean;

  // Exigir vehículo en servicio (EXISTS vehicles.status='in_service')
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @ValidateIf((_, v) => v === true || v === false)
  @IsBoolean()
  requireVehicleInService?: boolean;

  // last_location IS (NOT) NULL
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @ValidateIf((_, v) => v === true || v === false)
  @IsBoolean()
  hasLocation?: boolean;

  // Rangos por timestamps relevantes
  @IsOptional()
  @IsDateString()
  lastLocationFrom?: string;

  @IsOptional()
  @IsDateString()
  lastLocationTo?: string;

  @IsOptional()
  @IsDateString()
  lastOnlineFrom?: string;

  @IsOptional()
  @IsDateString()
  lastOnlineTo?: string;

  @IsOptional()
  @IsDateString()
  lastPresenceFrom?: string;

  @IsOptional()
  @IsDateString()
  lastPresenceTo?: string;

  @IsOptional()
  @IsDateString()
  updatedFrom?: string;

  @IsOptional()
  @IsDateString()
  updatedTo?: string;
}
