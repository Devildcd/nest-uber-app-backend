import { IsOptional, IsUUID } from 'class-validator';

export class UpdateDriverTripDto {
  /** set: UUID, unset: null o no enviar la prop */
  @IsOptional()
  @IsUUID()
  currentTripId?: string | null;
}
