import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  FindOneOptions,
  ILike,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Vehicle } from '../entities/vehicle.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { VehicleFilterDto } from '../dto/vehicle-filter.dto';
import { handleRepositoryError } from '../../../common/utils/handle-repository-error';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';

@Injectable()
export class VehicleRepository extends Repository<Vehicle> {
  private readonly logger = new Logger(VehicleRepository.name);
  private readonly entityName = 'Vehicle';

  constructor(dataSource: DataSource) {
    // IMPORTANT: pass an EntityManager from DataSource to the base Repository
    super(Vehicle, dataSource.createEntityManager());
  }

  /**
   * Crea y persiste una entidad Vehicle. Si se provee manager, lo usa (útil en transacciones).
   */
  async createAndSave(
    vehicleLike: DeepPartial<Vehicle> | CreateVehicleDto,
    manager?: EntityManager,
  ): Promise<Vehicle> {
    const repo = manager ? manager.getRepository(Vehicle) : this;
    const entity = repo.create(vehicleLike as DeepPartial<Vehicle>);
    try {
      return await repo.save(entity);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);      
    }
  }

  /**
   * Buscar por id con relaciones básicas.
   */
  async findById(id: string): Promise<Vehicle | null> {
    try {
      return await this.findOne({
        where: { id },
        relations: ['driver', 'driverProfile', 'vehicleType'],
      });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);      
    }
  }

  /**
   * Busca un vehículo por su plateNumber.
   * - Normaliza la placa (trim+uppercase) para comparar con la columna transformada.
   * - Acepta manager opcional para que la llamada pueda participar en transacciones (queryRunner.manager).
   */
  async findByPlateNumber(
    plateNumber: string,
    manager?: EntityManager,
  ): Promise<Vehicle | null> {
    const repo = manager ? manager.getRepository(Vehicle) : this;
    try {
      if (!plateNumber) return null;
      const normalized = plateNumber.trim().toUpperCase();
      return await repo.findOne({ where: { plateNumber: normalized } });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findByPlateNumber', this.entityName);
      
    }
  }

  /**
   * Búsqueda paginada con filtros aplicables.
   * Devuelve [items, total]
   */
  async findAllPaginated(
    pagination: PaginationDto,
    filters?: VehicleFilterDto,
  ): Promise<[Vehicle[], number]> {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      const qb: SelectQueryBuilder<Vehicle> = this.createQueryBuilder('vehicle')
        // Traer relaciones útiles para listados/detalle ligero. Ajusta según perf.
        .leftJoinAndSelect('vehicle.vehicleType', 'vehicleType')
        .leftJoinAndSelect('vehicle.driverProfile', 'driverProfile')
        .skip(skip)
        .take(limit)
        .orderBy('vehicle.createdAt', 'DESC');

      if (filters) {
        this.applyFilters(qb, filters);
      }

      return await qb.getManyAndCount();
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findAllPaginated', this.entityName);      
    }
  }

  /**
   * Aplica los filtros del DTO al QueryBuilder.
   */
  private applyFilters(qb: SelectQueryBuilder<Vehicle>, filters: VehicleFilterDto): void {
    if (!filters) return;

    if (filters.driverId) {
      // se puede filtrar por relación sin join explícito
      qb.andWhere('vehicle.driver = :driverId', { driverId: filters.driverId });
    }

    if (filters.driverProfileId) {
      qb.andWhere('vehicle.driverProfile = :driverProfileId', {
        driverProfileId: filters.driverProfileId,
      });
    }

    if (filters.vehicleTypeId) {
      qb.andWhere('vehicle.vehicleType = :vehicleTypeId', {
        vehicleTypeId: filters.vehicleTypeId,
      });
    }

    if (filters.plateNumber) {
      qb.andWhere('vehicle.plate_number ILIKE :plate', { plate: `%${filters.plateNumber}%` });
    }

    if (filters.status) {
      qb.andWhere('vehicle.status = :status', { status: filters.status });
    }

    if (filters.isActive !== undefined) {
      qb.andWhere('vehicle.isActive = :isActive', { isActive: filters.isActive });
    }

    if (filters.minYear !== undefined) {
      qb.andWhere('vehicle.year >= :minYear', { minYear: filters.minYear });
    }

    if (filters.maxYear !== undefined) {
      qb.andWhere('vehicle.year <= :maxYear', { maxYear: filters.maxYear });
    }

    if (filters.minCapacity !== undefined) {
      qb.andWhere('vehicle.capacity >= :minCapacity', { minCapacity: filters.minCapacity });
    }

    if (filters.maxCapacity !== undefined) {
      qb.andWhere('vehicle.capacity <= :maxCapacity', { maxCapacity: filters.maxCapacity });
    }
  }

  /**
   * Soft delete simple (marca deleted_at). Si necesitas remover relaciones en pivotes, implementar transacción similar.
   */
  async softDeleteVehicle(id: string): Promise<void> {
    try {
      await this.softDelete(id);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'softDeleteVehicle', this.entityName);      
    }
  }
  async findWithRelations(
    id: string,
    relations: string[] = [],
    options?: Omit<FindOneOptions<Vehicle>, 'relations' | 'where'>,
  ): Promise<Vehicle | null> {
    return this.findOne({
      where: { id } as any, 
      relations,
      ...options,
    });
  }
}
