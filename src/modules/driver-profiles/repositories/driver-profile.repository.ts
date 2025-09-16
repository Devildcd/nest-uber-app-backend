import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  SelectQueryBuilder,
} from 'typeorm';
import {
  BackgroundCheckStatus,
  DriverProfile,
  DriverStatus,
} from '../entities/driver-profile.entity';
import { DriverProfileFiltersDto } from '../dto/driver-profile-filters.dto';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { BaseRepository } from 'src/common/repositories/base.repository';

@Injectable()
export class DriverProfileRepository extends BaseRepository<DriverProfile> {
  constructor(dataSource: DataSource) {
    super(
      DriverProfile,
      dataSource.createEntityManager(),
      'DriverProfileRepository',
      'DriverProfile',
    );
  }

  /** Crear y guardar */
  async createAndSave(
    profileLike: DeepPartial<DriverProfile>,
    manager?: EntityManager,
  ): Promise<DriverProfile> {
    const repo = this.scoped(manager);
    const profile = repo.create(profileLike);
    try {
      return await repo.save(profile);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
      throw err;
    }
  }

  async findById(
    id: string,
    manager?: EntityManager,
  ): Promise<DriverProfile | null> {
    try {
      const repo = this.scoped(manager);
      return repo.findOne({ where: { id }, relations: ['user'] });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
      throw err;
    }
  }

  /** Listado paginado con entidades (siguiendo misma línea que availability) */
  async findAllPaginated(
    pagination: PaginationDto,
    filters?: DriverProfileFiltersDto,
    manager?: EntityManager,
  ): Promise<[DriverProfile[], number]> {
    const { page = 1, limit = 10 } = pagination;

    const qb = this.scoped(manager)
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.user', 'user')
      // usa snake_case en ORDER BY
      .orderBy('profile.updatedAt', 'DESC')
      .addOrderBy('profile.createdAt', 'DESC');

    if (filters) this.applyFilters(qb, filters);
    this.paginate(qb, page, limit);

    try {
      return await this.getManyAndCountSafe(qb, 'findAllPaginated');
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findAllPaginated',
        this.entityName,
      );
      throw err;
    }
  }

  async findByUserId(
    userId: string,
    manager?: EntityManager,
  ): Promise<DriverProfile | null> {
    try {
      const repo = this.scoped(manager);
      return repo.findOne({
        where: { user: { id: userId } },
        relations: ['user'],
      });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findByUserId', this.entityName);
      throw err;
    }
  }

  async findByUserIdForEligibility(
    userId: string,
    manager?: EntityManager,
  ): Promise<DriverProfile | null> {
    const repo = this.scoped(manager);
    return repo.findOne({
      where: { user: { id: userId } },
      select: { id: true, isApproved: true, driverStatus: true },
      relations: { user: false },
    });
  }

  /** Update parcial por id + recarga (acepta manager para usar en TX) */
  async updateProfile(
    id: string,
    updateData: DeepPartial<DriverProfile>,
    manager?: EntityManager,
  ): Promise<DriverProfile> {
    const repo = this.scoped(manager);
    try {
      const result = await repo.update({ id }, updateData);
      if (!result.affected) {
        throw new NotFoundException('DriverProfile not found');
      }
      const updated = await repo.findOne({
        where: { id },
        relations: ['user'],
      });
      if (!updated) {
        throw new NotFoundException('DriverProfile not found after update');
      }
      return updated;
    } catch (err) {
      handleRepositoryError(this.logger, err, 'updateProfile', this.entityName);
      throw err;
    }
  }

  async softDeleteProfile(id: string, manager?: EntityManager): Promise<void> {
    const repo = this.scoped(manager);
    try {
      await repo.softDelete(id);
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'softDeleteProfile',
        this.entityName,
      );
      throw err;
    }
  }

  // -------- Helpers de negocio atómicos (aplican invariantes) --------

  async setBackgroundCheckStatusTx(
    id: string,
    status: BackgroundCheckStatus,
    manager?: EntityManager,
  ): Promise<DriverProfile> {
    const patch: DeepPartial<DriverProfile> = { backgroundCheckStatus: status };
    if (status === BackgroundCheckStatus.REJECTED) {
      patch.isApproved = false;
      patch.driverStatus = DriverStatus.SUSPENDED;
    }
    return this.updateProfile(id, patch, manager);
  }

  async setDriverStatusTx(
    id: string,
    status: DriverStatus,
    manager?: EntityManager,
  ): Promise<DriverProfile> {
    const patch: DeepPartial<DriverProfile> = { driverStatus: status };
    if (status === DriverStatus.DEACTIVATED) patch.isApproved = false;
    if (status === DriverStatus.ACTIVE) patch.isApproved = true;
    return this.updateProfile(id, patch, manager);
  }

  async setApprovedTx(
    id: string,
    isApproved: boolean,
    manager?: EntityManager,
  ): Promise<DriverProfile> {
    const patch: DeepPartial<DriverProfile> = { isApproved };
    if (isApproved) patch.driverStatus = DriverStatus.ACTIVE;
    else patch.driverStatus = DriverStatus.SUSPENDED; // salvo que otra capa lo fuerce a DEACTIVATED
    return this.updateProfile(id, patch, manager);
  }

  // ---------- filtros ----------
  private applyFilters(
    qb: SelectQueryBuilder<DriverProfile>,
    f: DriverProfileFiltersDto,
  ): void {
    if (f.userId) {
      qb.andWhere('profile.user_id = :userId', { userId: f.userId });
    }
    if (f.driverLicenseNumber) {
      qb.andWhere('profile.driver_license_number ILIKE :dl', {
        dl: `%${f.driverLicenseNumber}%`,
      });
    }
    if (f.backgroundCheckStatus) {
      qb.andWhere('profile.background_check_status = :bcs', {
        bcs: f.backgroundCheckStatus,
      });
    }
    if (typeof f.isApproved === 'boolean') {
      qb.andWhere('profile.is_approved = :ia', { ia: f.isApproved });
    }
    if (f.driverStatus) {
      qb.andWhere('profile.driver_status = :ds', { ds: f.driverStatus });
    }
  }
}
