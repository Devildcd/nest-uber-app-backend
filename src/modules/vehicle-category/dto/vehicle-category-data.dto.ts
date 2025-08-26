import { Expose } from 'class-transformer';

export class VehicleCategoryDataDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  description?: string;

  @Expose()
  iconUrl?: string;

  @Expose()
  isActive: boolean;

  @Expose()
  createdAt: string;

  @Expose()
  updatedAt: string;

  @Expose()
  deletedAt?: string;
}
