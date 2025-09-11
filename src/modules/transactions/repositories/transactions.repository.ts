import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  FindOneOptions,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TransactionFiltersDto } from '../dto/transaction-filters.dto';
import { handleRepositoryError } from '../../../common/utils/handle-repository-error';
import { CreateTransactionDto } from '../dto/create-transaction.dto';

@Injectable()
export class TransactionRepository extends Repository<Transaction> {
  private readonly logger = new Logger(TransactionRepository.name);
  private readonly entityName = 'Transaction';

  constructor(dataSource: DataSource) {
    // IMPORTANT: pass an EntityManager from DataSource to the base Repository
    super(Transaction, dataSource.createEntityManager());
  }

  /**
   * Crea y persiste una entidad Transaction. Si se provee manager, lo usa (útil en transacciones).
   */
  async createAndSave(
    transactionLike: DeepPartial<Transaction> | CreateTransactionDto,
    manager?: EntityManager,
  ): Promise<Transaction> {
    const repo = manager ? manager.getRepository(Transaction) : this;
    const entity = repo.create(transactionLike as DeepPartial<Transaction>);
    try {
      return await repo.save(entity);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  /**
   * Buscar por id con relaciones básicas.
   */
  async findById(id: string): Promise<Transaction | null> {
    try {
      return await this.findOne({
        where: { id },
        relations: ['order', 'trip', 'fromUser', 'toUser'],
      });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }

  /**
   * Búsqueda paginada con filtros aplicables.
   * Devuelve [items, total]
   */
  async findAllPaginated(
    pagination: PaginationDto,
    filters?: TransactionFiltersDto,
  ): Promise<[Transaction[], number]> {
    try {
      const { page = 1, limit = 20 } = pagination;
      const skip = (page - 1) * limit;

      const qb: SelectQueryBuilder<Transaction> = this.createQueryBuilder('transaction')
        // relaciones útiles para listados/detalle ligero
        .leftJoinAndSelect('transaction.fromUser', 'fromUser')
        .leftJoinAndSelect('transaction.toUser', 'toUser')
        .leftJoinAndSelect('transaction.order', 'order')
        .leftJoinAndSelect('transaction.trip', 'trip')
        .skip(skip)
        .take(limit)
        .orderBy('transaction.createdAt', 'DESC');

      if (filters) {
        this.applyFilters(qb, filters);
      }

      return await qb.getManyAndCount();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findAllPaginated',
        this.entityName,
      );
    }
  }

  /**
   * Aplica los filtros del DTO al QueryBuilder.
   */
  private applyFilters(
    qb: SelectQueryBuilder<Transaction>,
    filters: TransactionFiltersDto,
  ): void {
    if (!filters) return;

    if (filters.type) {
      qb.andWhere('transaction.type = :type', { type: filters.type });
    }

    if (filters.status) {
      qb.andWhere('transaction.status = :status', { status: filters.status });
    }

    if (filters.fromUserId) {
      qb.andWhere('fromUser.id = :fromUserId', { fromUserId: filters.fromUserId });
    }

    if (filters.toUserId) {
      qb.andWhere('toUser.id = :toUserId', { toUserId: filters.toUserId });
    }

    if (filters.minAmount !== undefined && filters.minAmount !== null) {
      qb.andWhere('transaction.grossAmount >= :minAmount', { minAmount: filters.minAmount });
    }

    if (filters.maxAmount !== undefined && filters.maxAmount !== null) {
      qb.andWhere('transaction.grossAmount <= :maxAmount', { maxAmount: filters.maxAmount });
    }

    if (filters.startDate) {
      qb.andWhere('transaction.createdAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      qb.andWhere('transaction.createdAt <= :endDate', { endDate: filters.endDate });
    }

    if (filters.search) {
      const q = `%${filters.search}%`;
      qb.andWhere(
        `(transaction.id ILIKE :q OR fromUser.name ILIKE :q OR fromUser.email ILIKE :q OR toUser.name ILIKE :q OR toUser.email ILIKE :q)`,
        { q },
      );
    }
  }

  /**
   * Soft delete (marca deleted_at).
   */
  async softDeleteTransaction(id: string): Promise<void> {
    try {
      const result = await this.softDelete(id);
      if (result.affected === 0) {
      throw new NotFoundException(`Transaction ${id} not found`);
}
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'softDeleteTransaction',
        this.entityName,
      );
    }
  }

  /**
   * Buscar con relaciones dinámicas.
   */
  async findWithRelations(
    id: string,
    relations: string[] = [],
    options?: Omit<FindOneOptions<Transaction>, 'relations' | 'where'>,
    manager?: EntityManager,
  ): Promise<Transaction | null> {
    const repo = manager ? manager.getRepository(Transaction) : this;
    try {
    return await repo.findOne({
      where: { id } as any,
      relations,
      ...options,
    });
  } catch (err) {
    handleRepositoryError(this.logger, err, 'findWithRelations', this.entityName);
  }
  }
}
