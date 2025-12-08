import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  Repository,
  DeepPartial,
  SelectQueryBuilder,
  EntityManager,
} from 'typeorm';
import { User, UserType } from '../entities/user.entity';
import { UserFiltersDto } from '../dto/user-filters.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { geoWgs84Expr } from 'src/common/utils/geo.utils';

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

  /** Escribe currentLocation / currentLocationTimestamp (solo PASSENGER) */
  async updatePassengerLocationByUserId(
    userId: string,
    patch: QueryDeepPartialEntity<User> & {
      __lat__?: number;
      __lng__?: number;
    },
    manager?: EntityManager,
  ): Promise<User> {
    try {
      const repo = manager ? manager.getRepository(User) : this;

      // 1) validar PASSENGER vivo
      const row = await repo.findOne({
        where: {
          id: userId,
          userType: UserType.PASSENGER,
          deletedAt: null as any,
        },
        select: { id: true, userType: true },
      });
      if (!row) {
        const exists = await repo.exist({ where: { id: userId } });
        if (exists)
          throw new ForbiddenException('Only passengers can update location');
        throw new NotFoundException(`User ${userId} not found`);
      }

      // 2) si patch está vacío y NO pide setear location ⇒ no-op (devuelve actual)
      const wantsRawLoc =
        typeof patch.__lat__ === 'number' && typeof patch.__lng__ === 'number';
      const hasOtherKeys = Object.keys(patch ?? {}).some(
        (k) => !['__lat__', '__lng__'].includes(k),
      );
      if (!wantsRawLoc && !hasOtherKeys) {
        const current = await repo.findOne({ where: { id: userId } });
        if (!current)
          throw new NotFoundException(`User ${userId} not found after noop`);
        return current;
      }

      // 3) construir UPDATE
      if (wantsRawLoc) {
        const { __lat__: lat, __lng__: lng, ...rest } = patch;

        // build set: currentLocation por SQL + cualquier otro campo plano de `rest`
        await repo
          .createQueryBuilder()
          .update(User)
          .set({
            ...(rest as any),
            currentLocation: geoWgs84Expr(), // 👈 geography por SQL
          })
          .where({ id: userId, userType: UserType.PASSENGER })
          .setParameters({ lat, lng })
          .execute();
      } else {
        // NO hay __lat__/__lng__, pero sí otros campos “planos” (no relaciones)
        await repo.update({ id: userId, userType: UserType.PASSENGER }, patch);
      }

      // 4) devolver actualizado
      const updated = await repo.findOne({ where: { id: userId } });
      if (!updated)
        throw new NotFoundException(`User ${userId} not found after update`);
      return updated;
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'updatePassengerLocationByUserId',
        this.entityName,
      );
      throw err;
    }
  }

  /** Distancia (m) entre currentLocation y un punto; null si no había posición previa */
  async distanceToCurrentLocation(
    userId: string,
    lng: number,
    lat: number,
    manager?: EntityManager,
  ): Promise<number | null> {
    try {
      const repo = manager ? manager.getRepository(User) : this;
      const row = await repo
        .createQueryBuilder('u')
        .select([
          'u.currentLocation AS "currentLocation"',
          `CASE
             WHEN u."currentLocation" IS NULL THEN NULL
             ELSE ST_Distance(
               u."currentLocation",
               ST_SetSRID(ST_MakePoint(:lng,:lat),4326)::geography
             )
           END AS "distance"`,
        ])
        .where('u.id = :userId', { userId })
        .setParameters({ lng, lat })
        .limit(1)
        .getRawOne<{ currentLocation: any; distance: number | null }>();

      return row?.distance ?? null;
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'distanceToCurrentLocation',
        this.entityName,
      );
      throw err;
    }
  }
}
