import { Expose } from 'class-transformer';

/**
 * DTO que representa un item de la lista de vehicle service classes
 */
export class VehicleServiceClassListItemDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  description?: string;

  @Expose()
  baseFareMultiplier: number;

  @Expose()
  costPerKmMultiplier: number;

  @Expose()
  costPerMinuteMultiplier: number;

  @Expose()
  minFareMultiplier: number;

  @Expose()
  minCapacity: number;

  @Expose()
  maxCapacity: number;

  @Expose()
  iconUrl?: string;

  @Expose()
  isActive: boolean;
}
