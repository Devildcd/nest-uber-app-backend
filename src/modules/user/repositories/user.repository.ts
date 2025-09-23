import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  Repository,
  DeepPartial,
  SelectQueryBuilder,
  EntityManager,
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

  private scoped(manager?: EntityManager): Repository<User> {
    return manager ? manager.getRepository(User) : this;
  }

  async createAndSave(userLike: DeepPartial<User>): Promise<User> {
    const user = this.create(userLike);
    try {
      return await this.save(user);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  /** Obtener por id con relaciones (authCredentials, vehicles) */
  async findById(
    id: string,
    manager?: EntityManager,
    opts: { relations?: boolean | string[] } = { relations: true },
  ): Promise<User | null> {
    const repo = this.scoped(manager);
    try {
      if (opts.relations) {
        const rels =
          typeof opts.relations === 'boolean'
            ? { authCredentials: true, vehicles: true }
            : opts.relations;
        return await repo.findOne({
          where: { id } as any,
          relations: rels as any,
        });
      }
      return await repo.findOne({ where: { id } as any });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }

  /** Sólo por email/username si lo necesitas */
  async findByEmail(
    email: string,
    manager?: EntityManager,
  ): Promise<User | null> {
    const repo = this.scoped(manager);
    try {
      return await repo.findOne({ where: { email } as any });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findByEmail', this.entityName);
    }
  }

  /** Con lock (para flujos que cambian estado/cuentas) */
  async findByIdForUpdate(
    id: string,
    manager: EntityManager,
  ): Promise<User | null> {
    try {
      return await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .where('u.id = :id', { id })
        .getOne();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findByIdForUpdate',
        this.entityName,
      );
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
