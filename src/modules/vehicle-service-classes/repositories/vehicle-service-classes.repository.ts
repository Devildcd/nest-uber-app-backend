import {
  DataSource,
  DeepPartial,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Logger, NotFoundException } from '@nestjs/common';
import { VehicleServiceClass } from '../entities/vehicle-service-classes.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { VehicleServiceClassFiltersDto } from '../dto/vehicle-service-class-filter.dto';
import { CreateVehicleServiceClassDto } from '../dto/create-vehicle-service-class.dto';
import { UpdateVehicleServiceClassDto } from '../dto/update-vehicle-service-class.dto';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';

export class VehicleServiceClassRepository extends Repository<VehicleServiceClass> {
  private readonly logger = new Logger(VehicleServiceClassRepository.name);
  private readonly entityName = 'VehicleServiceClass';

  constructor(dataSource: DataSource) {
    super(VehicleServiceClass, dataSource.createEntityManager());
  }

  async createAndSave(
    serviceLike: CreateVehicleServiceClassDto,
    manager?: EntityManager,
  ): Promise<VehicleServiceClass> {
    const repo = manager ? manager.getRepository(VehicleServiceClass) : this;
    const serviceClass = repo.create(serviceLike);

    try {
      return await repo.save(serviceClass);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  async findById(id: string): Promise<VehicleServiceClass | null> {
    try {
      return this.findOne({ where: { id } });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }

  async findByName(name: string): Promise<VehicleServiceClass | null> {
    try {
      return this.findOne({ where: { name } });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findByName', this.entityName);
    }
  }

  async findAllPaginated(
    pagination: PaginationDto,
    filters?: VehicleServiceClassFiltersDto,
  ): Promise<[VehicleServiceClass[], number]> {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      const qb: SelectQueryBuilder<VehicleServiceClass> =
        this.createQueryBuilder('serviceClass')
          .skip(skip)
          .take(limit)
          .orderBy('serviceClass.createdAt', 'DESC');

      if (filters) {
        this.applyFilters(qb, filters);
      }

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

  async updateCategory(
    id: string,
    updateData: UpdateVehicleServiceClassDto,
  ): Promise<VehicleServiceClass> {
    const queryRunner = this.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(VehicleServiceClass, id, updateData);
      const updated = await queryRunner.manager.findOne(VehicleServiceClass, {
        where: { id },
      });
      if (!updated) {
        throw new NotFoundException(
          `${this.entityName} not found after update`,
        );
      }
      await queryRunner.commitTransaction();
      return updated;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      handleRepositoryError(
        this.logger,
        err,
        'updateServiceClass',
        this.entityName,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async softDeleteService(id: string): Promise<void> {
    try {
      const serviceClass = await this.findOne({ where: { id } });
      if (!serviceClass)
        throw new NotFoundException(`${this.entityName} not found`);
      await this.softDelete(id);
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'softDeleteService',
        this.entityName,
      );
    }
  }

  private applyFilters(
    qb: SelectQueryBuilder<VehicleServiceClass>,
    filters: VehicleServiceClassFiltersDto,
  ): void {
    if (filters.name) {
      qb.andWhere('serviceClass.name ILIKE :name', {
        name: `%${filters.name}%`,
      });
    }
    if (filters.isActive !== undefined) {
      qb.andWhere('serviceClass.isActive = :active', {
        active: filters.isActive,
      });
    }
  }
}
