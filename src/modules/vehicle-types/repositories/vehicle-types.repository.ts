import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { VehicleType } from '../entities/vehicle-types.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { VehicleTypeFilterDto } from '../dto/vehicle-types-filter.dto';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { CreateVehicleTypeDto } from '../dto/create-vehicle-types.dto';
import { VehicleServiceClass } from 'src/modules/vehicle-service-classes/entities/vehicle-service-classes.entity';

@Injectable()
export class VehicleTypeRepository extends Repository<VehicleType> {
  private readonly logger = new Logger(VehicleTypeRepository.name);
  private readonly entityName = 'VehicleType';

  constructor(dataSource: DataSource) {
    super(VehicleType, dataSource.createEntityManager());
  }

  async createAndSave(
    typeLike: DeepPartial<VehicleType>,
    manager?: EntityManager,
  ): Promise<VehicleType> {
    const repo = manager ? manager.getRepository(VehicleType) : this;

    const type = repo.create(typeLike);
    try {
      return await repo.save(type);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  async findById(id: string): Promise<VehicleType | null> {
    try {
      return this.findOne({
        where: { id },
        relations: ['category','serviceClasses'],
      });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }
 async findByName(name: string): Promise<VehicleType | null> {
    try {
      return this.findOne({ where: { name } });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findByName', this.entityName);
    }
  }

  async findAllPaginated(
    pagination: PaginationDto,
    filters?: VehicleTypeFilterDto,
      ): Promise<[VehicleType[], number]> {
        try {
          const { page = 1, limit = 10 } = pagination;
          const skip = (page - 1) * limit;
    
          const qb: SelectQueryBuilder<VehicleType> = this.createQueryBuilder(
            'vehicleType',
          )
            .leftJoinAndSelect('vehicleType.category', 'category')
            .leftJoinAndSelect('vehicleType.serviceClasses', 'serviceClass')
            .skip(skip)
            .take(limit)
            .orderBy('vehicleType.createdAt', 'DESC');
    
          if (filters) {
            this.applyFilters(qb, filters);
            };
    
          return qb.getManyAndCount();
        } catch (err) {
          handleRepositoryError(
            this.logger,
            err,
            'findAllPaginated',
            this.entityName,
          );
        }
      }
  private applyFilters(
      qb: SelectQueryBuilder<VehicleType>,
      filters: VehicleTypeFilterDto,
    ): void {
      if (filters.categoryId) {
        qb.andWhere('vehicleType.category_id = :categoryId', {
          categoryId: filters.categoryId,
        });
      }
      if (filters.name) {
        qb.andWhere('vehicleType.name ILIKE :name', {
          name: `%${filters.name}%`,
        });
      }
      if (filters.isActive !== undefined) {
        qb.andWhere('vehicleType.is_active = :isActive', {
          isActive: filters.isActive,
        });
      }
      // Clases de servicio (varios UUIDs en array)
  if (filters.serviceClassIds && filters.serviceClassIds.length > 0) {
    qb.andWhere('vehicleType.service_class_id IN (:...serviceClassIds)', {
      serviceClassIds: filters.serviceClassIds,
    });
    qb.distinct(true); // evita duplicados por la join many-to-many
  }
  // Capacidad mínima
  if (filters.minCapacity !== undefined) {
    qb.andWhere('vehicleType.capacity >= :minCapacity', {
      minCapacity: filters.minCapacity,
    });
  }

  // Capacidad máxima
  if (filters.maxCapacity !== undefined) {
    qb.andWhere('vehicleType.capacity <= :maxCapacity', {
      maxCapacity: filters.maxCapacity,
    });
  }
  // Tarifa base mínima
  if (filters.minBaseFare !== undefined) {
    qb.andWhere('vehicleType.base_fare >= :minBaseFare', {
      minBaseFare: filters.minBaseFare,
    });
  }

  // Tarifa base máxima
  if (filters.maxBaseFare !== undefined) {
    qb.andWhere('vehicleType.base_fare <= :maxBaseFare', {
      maxBaseFare: filters.maxBaseFare,
    });
  }
}
async softDeleteProfile(id: string): Promise<void> {
    try {
      await this.softDelete(id);
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'softDeleteType',
        this.entityName,
      );
    }
  }
}

