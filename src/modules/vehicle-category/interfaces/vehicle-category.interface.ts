/**
 * Interface: IVehicleCategory
 * Utilizada en DTOs y servicios para tipar el objeto categoría de vehículo.
 */
export interface IVehicleCategory {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
