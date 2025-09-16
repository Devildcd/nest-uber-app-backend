import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  FindOneOptions,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../entities/transaction.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TransactionFiltersDto } from '../dto/transaction-filters.dto';
import { handleRepositoryError } from '../../../common/utils/handle-repository-error';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { _roundTo2 } from '../../../common/validators/decimal.transformer';
import { formatErrorResponse } from 'src/common/utils/api-response.utils';

function r2(n: number) {
  return Math.round(n * 100) / 100;
}
@Injectable()
export class TransactionRepository extends Repository<Transaction> {
  private readonly logger = new Logger(TransactionRepository.name);
  private readonly entityName = 'Transaction';

  constructor(dataSource: DataSource) {
    super(Transaction, dataSource.createEntityManager());
  }

  async findChargeByOrder(
    manager: EntityManager,
    orderId: string,
  ): Promise<Transaction | null> {
    return manager.getRepository(Transaction).findOne({
      where: { type: TransactionType.CHARGE, order: { id: orderId } as any },
      relations: ['order'],
    });
  }

  async createOrGetChargeForOrder(
    manager: EntityManager,
    params: {
      orderId: string;
      tripId: string;
      passengerId: string; // fromUser
      driverId: string; // toUser
      gross: number;
      commission: number;
      net: number;
      currency: string;
      description?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<Transaction> {
    const repo = manager.getRepository(Transaction);
    const existing = await this.findChargeByOrder(manager, params.orderId);
    if (existing) {
      const same =
        existing.currency === params.currency &&
        Math.abs(r2(existing.grossAmount) - r2(params.gross)) < 0.005 &&
        Math.abs(r2(existing.platformFeeAmount) - r2(params.commission)) <
          0.005 &&
        Math.abs(r2(existing.netAmount) - r2(params.net)) < 0.005;

      if (!same) {
        throw new ConflictException(
          formatErrorResponse(
            'TX_CHARGE_MISMATCH',
            'Existe un CHARGE para la order con importes distintos.',
            {
              orderId: params.orderId,
              existing: {
                grossAmount: existing.grossAmount,
                platformFeeAmount: existing.platformFeeAmount,
                netAmount: existing.netAmount,
                currency: existing.currency,
              },
              requested: {
                gross: params.gross,
                commission: params.commission,
                net: params.net,
                currency: params.currency,
              },
            },
          ),
        );
      }
      // normaliza a PROCESSED
      if (existing.status !== TransactionStatus.PROCESSED) {
        existing.status = TransactionStatus.PROCESSED;
        existing.processedAt = new Date();
        await repo.save(existing);
      }
      return existing;
    }

    const tx = repo.create({
      type: TransactionType.CHARGE,
      order: { id: params.orderId } as any,
      fromUser: { id: params.passengerId } as any,
      toUser: { id: params.driverId } as any,
      tripId: { id: params.tripId } as any,
      grossAmount: r2(params.gross),
      platformFeeAmount: r2(params.commission),
      netAmount: r2(params.net),
      currency: params.currency,
      status: TransactionStatus.PROCESSED,
      processedAt: new Date(),
      description: params.description ?? 'trip charge (cash)',
      metadata: params.metadata || undefined,
    } as DeepPartial<Transaction>);
    return repo.save(tx);
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

      const qb: SelectQueryBuilder<Transaction> = this.createQueryBuilder(
        'transaction',
      )
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
      qb.andWhere('fromUser.id = :fromUserId', {
        fromUserId: filters.fromUserId,
      });
    }

    if (filters.toUserId) {
      qb.andWhere('toUser.id = :toUserId', { toUserId: filters.toUserId });
    }

    if (filters.minAmount !== undefined && filters.minAmount !== null) {
      qb.andWhere('transaction.grossAmount >= :minAmount', {
        minAmount: filters.minAmount,
      });
    }

    if (filters.maxAmount !== undefined && filters.maxAmount !== null) {
      qb.andWhere('transaction.grossAmount <= :maxAmount', {
        maxAmount: filters.maxAmount,
      });
    }

    if (filters.startDate) {
      qb.andWhere('transaction.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      qb.andWhere('transaction.createdAt <= :endDate', {
        endDate: filters.endDate,
      });
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
      handleRepositoryError(
        this.logger,
        err,
        'findWithRelations',
        this.entityName,
      );
    }
  }
  /**
   * Busca una transacción PLATFORM_COMMISSION idempotente por (trip, fromUser).
   */
  async findExistingPlatformCommission(
    manager: EntityManager,
    params: { driverId: string; tripId: string },
  ): Promise<Transaction | null> {
    return manager.getRepository(Transaction).findOne({
      where: {
        type: TransactionType.PLATFORM_COMMISSION,
        trip: { id: params.tripId } as any,
        fromUser: { id: params.driverId } as any,
      },
    });
  }
  /**
   * Crea (o devuelve) una transacción de tipo PLATFORM_COMMISSION.
   * - Idempotente por (type=PLATFORM_COMMISSION, trip_id, from_user_id)
   * - Marca la transacción como PROCESSED y setea processedAt
   * - Mapea commission => gross/net; platformFeeAmount=0
   */
  async createPlatformCommission(
    manager: EntityManager,
    params: {
      driverId: string; // from_user_id (driver que debe la comisión)
      tripId: string; // trip_id asociado
      amount: number; // comisión positiva
      currency: string; // ISO 4217 (debe coincidir con el wallet)
      description?: string; // ej: 'cash trip commission'
      metadata?: Record<string, any>;
      toUserId?: string; // opcional: plataforma/empresa (si tienes un user representante)
    },
  ): Promise<Transaction> {
    const repo = manager.getRepository(Transaction);
    const commission = _roundTo2(params.amount);
    if (!isFinite(commission) || commission <= 0) {
      throw new ConflictException('La comisión debe ser un número positivo.');
    }
    // 1) Idempotencia por (type, trip_id, from_user_id)
    const existing = await this.findExistingPlatformCommission(manager, {
      driverId: params.driverId,
      tripId: params.tripId,
    });

    if (existing) {
      // Validar coherencia de importe/moneda si ya existe
      const sameCurrency = existing.currency === params.currency;
      const sameAmount =
        Math.abs(_roundTo2(existing.netAmount) - commission) < 0.005 &&
        Math.abs(_roundTo2(existing.grossAmount) - commission) < 0.005 &&
        _roundTo2(existing.platformFeeAmount) === 0;

      if (!sameCurrency || !sameAmount) {
        throw new ConflictException(
          'Ya existe una transacción de comisión para este trip/driver con valores distintos.',
        );
      }

      // Si existía pero no estaba PROCESSED, lo promovemos idempotentemente
      if (existing.status !== TransactionStatus.PROCESSED) {
        existing.status = TransactionStatus.PROCESSED;
        existing.processedAt = new Date();
        await repo.save(existing);
      }

      return existing;
    }

    // 2) Crear nueva transacción PROCESSED
    const tx = repo.create({
      type: TransactionType.PLATFORM_COMMISSION,
      trip: { id: params.tripId } as any,
      fromUser: { id: params.driverId } as any,
      toUser: params.toUserId ? ({ id: params.toUserId } as any) : null,
      grossAmount: commission,
      platformFeeAmount: 0,
      netAmount: commission,
      currency: params.currency,
      status: TransactionStatus.PROCESSED,
      processedAt: new Date(),
      description: params.description ?? 'cash trip commission',
      metadata: params.metadata ?? null,
    } as DeepPartial<Transaction>);

    try {
      return await repo.save(tx);
    } catch (err: any) {
      // Si hay unique en DB, resolvemos por idempotencia
      if (err?.code === '23505') {
        const again = await this.findExistingPlatformCommission(manager, {
          driverId: params.driverId,
          tripId: params.tripId,
        });
        if (again) return again;
      }
      handleRepositoryError(
        this.logger,
        err,
        'createPlatformCommission',
        'Transaction',
      );
    }
  }

  async createWalletTopupPending(
    manager: EntityManager,
    params: {
      driverId: string; // from_user_id = driver (quien entrega el efectivo)
      toUserId?: string | null; // opcional: cuenta plataforma/tesorería
      amount: number; // positivo
      currency: string;
      description?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<Transaction> {
    const repo = manager.getRepository(Transaction);
    const amt = _roundTo2(params.amount);

    const tx = repo.create({
      type: TransactionType.WALLET_TOPUP,
      fromUser: { id: params.driverId } as any,
      toUser: params.toUserId ? ({ id: params.toUserId } as any) : null,
      grossAmount: amt,
      platformFeeAmount: 0,
      netAmount: amt,
      currency: params.currency,
      status: TransactionStatus.PENDING,
      description: params.description ?? 'cash wallet topup',
      metadata: params.metadata ?? null,
    } as DeepPartial<Transaction>);

    return repo.save(tx);
  }

  async markProcessed(manager: EntityManager, txId: string): Promise<void> {
    await manager
      .getRepository(Transaction)
      .update(
        { id: txId },
        { status: TransactionStatus.PROCESSED, processedAt: new Date() },
      );
  }
}
