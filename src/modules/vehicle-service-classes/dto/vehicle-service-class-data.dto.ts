import { Expose } from 'class-transformer';

export class VehicleServiceClassDataDto {
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
  displayOrder?: number;

  @Expose()
  isActive: boolean;

  @Expose()
  createdAt: string;

  @Expose()
  updatedAt: string;

  @Expose()
  deletedAt?: string;
}
