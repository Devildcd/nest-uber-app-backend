import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { DriverProfile } from '../entities/driver-profile.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { DriverProfileFiltersDto } from '../dto/driver-profile-filters.dto';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';

@Injectable()
export class DriverProfileRepository extends Repository<DriverProfile> {
  private readonly logger = new Logger(DriverProfileRepository.name);
  private readonly entityName = 'DriverProfile';

  constructor(dataSource: DataSource) {
    super(DriverProfile, dataSource.createEntityManager());
  }

  async createAndSave(
    profileLike: DeepPartial<DriverProfile>,
    manager?: EntityManager,
  ): Promise<DriverProfile> {
    const repo = manager ? manager.getRepository(DriverProfile) : this;

    const profile = repo.create(profileLike);
    try {
      return await repo.save(profile);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  async findById(id: string): Promise<DriverProfile | null> {
    try {
      return this.findOne({
        where: { id },
        relations: ['user'],
      });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }

  async findByUserId(userId: string): Promise<DriverProfile | null> {
    try {
      return this.findOne({
        where: { user: { id: userId } },
        relations: ['user'],
      });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findByUserId', this.entityName);
    }
  }

  async findAllPaginated(
    pagination: PaginationDto,
    filters?: DriverProfileFiltersDto,
  ): Promise<[DriverProfile[], number]> {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      const qb: SelectQueryBuilder<DriverProfile> = this.createQueryBuilder(
        'profile',
      )
        .leftJoinAndSelect('profile.user', 'user')
        .skip(skip)
        .take(limit)
        .orderBy('profile.createdAt', 'DESC');

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

  async updateProfile(
    id: string,
    updateData: DeepPartial<DriverProfile>,
  ): Promise<DriverProfile> {
    const queryRunner = this.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(DriverProfile, id, updateData);
      const updated = await queryRunner.manager.findOne(DriverProfile, {
        where: { id },
        relations: ['user'],
      });
      if (!updated) {
        throw new NotFoundException('DriverProfile not found after update');
      }
      await queryRunner.commitTransaction();
      return updated;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      handleRepositoryError(this.logger, err, 'updateProfile', this.entityName);
    } finally {
      await queryRunner.release();
    }
  }

  async softDeleteProfile(id: string): Promise<void> {
    try {
      await this.softDelete(id);
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'softDeleteProfile',
        this.entityName,
      );
    }
  }

  private applyFilters(
    qb: SelectQueryBuilder<DriverProfile>,
    filters: DriverProfileFiltersDto,
  ): void {
    if (filters.userId) {
      qb.andWhere('profile.user_id = :userId', { userId: filters.userId });
    }
    if (filters.driverLicenseNumber) {
      qb.andWhere('profile.driver_license_number ILIKE :dl', {
        dl: `%${filters.driverLicenseNumber}%`,
      });
    }
    if (filters.backgroundCheckStatus) {
      qb.andWhere('profile.background_check_status = :status', {
        status: filters.backgroundCheckStatus,
      });
    }
    if (filters.isApproved !== undefined) {
      qb.andWhere('profile.is_approved = :approved', {
        approved: filters.isApproved,
      });
    }
    if (filters.onboardingStatus) {
      qb.andWhere('profile.onboarding_status = :onb', {
        onb: filters.onboardingStatus,
      });
    }
  }
}
