import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  Repository,
  DeepPartial,
  SelectQueryBuilder,
} from 'typeorm';
import { User } from '../entities/user.entity';
import { UserFiltersDto } from '../dto/user-filters.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';

@Injectable()
export class UserRepository extends Repository<User> {
  private readonly logger = new Logger(UserRepository.name);
  private readonly entityName = 'User';

  constructor(dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  async createAndSave(userLike: DeepPartial<User>): Promise<User> {
    const user = this.create(userLike);
    try {
      return await this.save(user);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  async existsByEmail(email: string): Promise<boolean> {
    try {
      return this.createQueryBuilder('user')
        .select('1')
        .where('LOWER(user.email) = LOWER(:email)', { email })
        .getExists();
    } catch (err) {
      handleRepositoryError(this.logger, err, 'existsByEmail', this.entityName);
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      return this.findOne({
        where: { id },
        relations: ['authCredentials', 'vehicles'],
      });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }

  async findAllPaginated(
    pagination: PaginationDto,
    filters?: UserFiltersDto,
  ): Promise<[User[], number]> {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      const query: SelectQueryBuilder<User> = this.createQueryBuilder('user')
        .leftJoinAndSelect('user.authCredentials', 'authCredentials')
        .skip(skip)
        .take(limit)
        .orderBy('user.createdAt', 'DESC');

      if (filters) {
        this.applyFilters(query, filters);
      }

      return query.getManyAndCount();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findAllPaginated',
        this.entityName,
      );
    }
  }

  async updateUser(id: string, updateData: DeepPartial<User>): Promise<User> {
    const queryRunner = this.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(User, id, updateData);
      const updatedUser = await queryRunner.manager.findOne(User, {
        where: { id },
        relations: ['authCredentials'],
      });

      if (!updatedUser) {
        throw new NotFoundException('User not found after update');
      }

      await queryRunner.commitTransaction();
      return updatedUser;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      handleRepositoryError(this.logger, err, 'updateUser', this.entityName);
    } finally {
      await queryRunner.release();
    }
  }

  async softDeleteUser(id: string): Promise<void> {
    try {
      await this.softDelete(id);
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'softDeleteUser',
        this.entityName,
      );
    }
  }

  private applyFilters(
    query: SelectQueryBuilder<User>,
    filters: UserFiltersDto,
  ): void {
    if (filters.email) {
      query.andWhere('LOWER(user.email) LIKE LOWER(:email)', {
        email: `%${filters.email}%`,
      });
    }

    if (filters.userType) {
      query.andWhere('user.userType = :userType', {
        userType: filters.userType,
      });
    }

    if (filters.status) {
      query.andWhere('user.status = :status', { status: filters.status });
    }

    if (filters.vehicleId) {
      query
        .leftJoin('user.vehicles', 'vehicle')
        .andWhere('vehicle.id = :vehicleId', { vehicleId: filters.vehicleId });
    }
  }
}
