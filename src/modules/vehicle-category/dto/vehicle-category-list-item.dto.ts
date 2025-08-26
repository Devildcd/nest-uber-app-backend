import { Expose } from 'class-transformer';

/**
 * DTO que representa un item de la lista de vehicles category
 */
export class VehicleCategoryListItemDto {
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
}
