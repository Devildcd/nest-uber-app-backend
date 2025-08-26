import {
  DataSource,
  DeepPartial,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Logger, NotFoundException } from '@nestjs/common';
import { VehicleCategory } from '../entities/vehicle-category.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { VehicleCategoryFiltersDto } from '../dto/vehicle-category-filters.dto';
import { CreateVehicleCategoryDto } from '../dto/create-vehicle-category.dto';
import { UpdateVehicleCategoryDto } from '../dto/update-vehicle-category.dto';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';

export class VehicleCategoryRepository extends Repository<VehicleCategory> {
  private readonly logger = new Logger(VehicleCategoryRepository.name);
  private readonly entityName = 'VehicleCategory';

  constructor(dataSource: DataSource) {
    super(VehicleCategory, dataSource.createEntityManager());
  }

  async createAndSave(
    categoryLike: CreateVehicleCategoryDto,
    manager?: EntityManager,
  ): Promise<VehicleCategory> {
    const repo = manager ? manager.getRepository(VehicleCategory) : this;
    const category = repo.create(categoryLike);

    try {
      return await repo.save(category);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  async findById(id: string): Promise<VehicleCategory | null> {
    try {
      return this.findOne({ where: { id } });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }

  async findByName(name: string): Promise<VehicleCategory | null> {
    try {
      return this.findOne({ where: { name } });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findByName', this.entityName);
    }
  }

  async findAllPaginated(
    pagination: PaginationDto,
    filters?: VehicleCategoryFiltersDto,
  ): Promise<[VehicleCategory[], number]> {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      const qb: SelectQueryBuilder<VehicleCategory> = this.createQueryBuilder(
        'category',
      )
        .skip(skip)
        .take(limit)
        .orderBy('category.createdAt', 'DESC');

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
    updateData: UpdateVehicleCategoryDto,
  ): Promise<VehicleCategory> {
    const queryRunner = this.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(VehicleCategory, id, updateData);
      const updated = await queryRunner.manager.findOne(VehicleCategory, {
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
        'updateCategory',
        this.entityName,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async softDeleteCategory(id: string): Promise<void> {
    try {
      const category = await this.findOne({ where: { id } });
      if (!category)
        throw new NotFoundException(`${this.entityName} not found`);
      await this.softDelete(id);
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'softDeleteCategory',
        this.entityName,
      );
    }
  }

  private applyFilters(
    qb: SelectQueryBuilder<VehicleCategory>,
    filters: VehicleCategoryFiltersDto,
  ): void {
    if (filters.name) {
      qb.andWhere('category.name ILIKE :name', { name: `%${filters.name}%` });
    }
    if (filters.isActive !== undefined) {
      qb.andWhere('category.isActive = :active', { active: filters.isActive });
    }
  }
}
