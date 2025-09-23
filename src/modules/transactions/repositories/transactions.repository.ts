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
   * Devuelve la comisión original (platformFeeAmount) para CARD/WALLET
   * leyendo el primer CHARGE PROCESSED asociado a la order (ORDER BY created_at ASC LIMIT 1).
   *
   * Firma consistente con el resto del repo: recibe `manager` (EntityManager de la tx).
   */
  async getOriginalFeeFromCharge(
    manager: EntityManager,
    orderId: string,
  ): Promise<number> {
    try {
      const repo = manager.getRepository(Transaction);
      const qb = repo
        .createQueryBuilder('t')
        .where('t.order_id = :orderId', { orderId })
        .andWhere('t.type = :type', { type: TransactionType.CHARGE })
        .andWhere('t.status = :status', { status: TransactionStatus.PROCESSED })
        .orderBy('t.created_at', 'ASC')
        .limit(1);

      const tx = await qb.getOne();
      return tx ? Number((tx as any).platformFeeAmount ?? 0) : 0;
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'getOriginalFeeFromCharge',
        this.entityName,
      );
      throw err;
    }
  }

  /**
   * Devuelve la comisión original para CASH consultando la primera COMMISSION_DEDUCTION PROCESSED.
   * (la comisión en tu modelo está almacenada como grossAmount en ese tipo de tx).
   */
  async getOriginalFeeFromCommissionDeduction(
    manager: EntityManager,
    orderId: string,
  ): Promise<number> {
    try {
      const repo = manager.getRepository(Transaction);
      const qb = repo
        .createQueryBuilder('t')
        .where('t.order_id = :orderId', { orderId })
        .andWhere('t.type = :type', {
          type: TransactionType.COMMISSION_DEDUCTION,
        })
        .andWhere('t.status = :status', { status: TransactionStatus.PROCESSED })
        .orderBy('t.created_at', 'ASC')
        .limit(1);

      const tx = await qb.getOne();
      return tx ? Number((tx as any).grossAmount ?? 0) : 0;
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'getOriginalFeeFromCommissionDeduction',
        this.entityName,
      );
      throw err;
    }
  }

  /**
   * Variante RAW SQL para obtener platform_fee_amount rápidamente.
   * - Útil en paths de solo lectura de alta concurrencia (menor overhead ORM).
   * - Usa manager.query para ejecutarlo dentro de la transacción/contexto correcto.
   */
  async getOriginalFeeFromChargeRaw(
    manager: EntityManager,
    orderId: string,
  ): Promise<number> {
    try {
      const rows = await manager.query(
        `SELECT platform_fee_amount::text AS platform_fee_amount
         FROM transactions
         WHERE order_id = $1
           AND type = $2
           AND status = $3
         ORDER BY created_at ASC
         LIMIT 1`,
        [orderId, TransactionType.CHARGE, TransactionStatus.PROCESSED],
      );

      if (!rows || rows.length === 0) return 0;
      return Number(rows[0].platform_fee_amount ?? 0);
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'getOriginalFeeFromChargeRaw',
        this.entityName,
      );
      throw err;
    }
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

  /**
   * Busca si ya existe una transacción REFUND para una order (idempotencia).
   */
  async findRefundByOrderId(
    manager: EntityManager,
    orderId: string,
  ): Promise<Transaction | null> {
    return manager.getRepository(Transaction).findOne({
      where: { type: TransactionType.REFUND, order: { id: orderId } as any },
      relations: ['order'],
    });
  }

  /**
   * Find a PLATFORM_COMMISSION transaction related to an order.
   *
   * Strategy:
   * 1) Try to find a PLATFORM_COMMISSION where order.id = orderId.
   * 2) If not found, load the order to obtain trip.id and try to find a PLATFORM_COMMISSION by trip.id.
   *
   * Returns null if none found.
   */
  async findPlatformCommissionByOrderId(
    manager: EntityManager,
    orderId: string,
  ): Promise<Transaction | null> {
    const repo = manager.getRepository(Transaction);

    // 1) try direct lookup by order relation
    const byOrder = await repo.findOne({
      where: {
        type: TransactionType.PLATFORM_COMMISSION,
        order: { id: orderId } as any,
      },
      relations: ['order', 'trip'],
    });
    if (byOrder) return byOrder;

    // 2) fallback: load order to get trip.id and search by trip (covers createPlatformCommission which sets trip)
    try {
      // import Order locally to avoid circular imports at top-level if needed
      const order = await manager.getRepository('order').findOne({
        where: { id: orderId } as any,
        relations: ['trip'],
      });

      const tripId = (order as any)?.trip?.id;
      if (!tripId) return null;

      const byTrip = await repo.findOne({
        where: {
          type: TransactionType.PLATFORM_COMMISSION,
          trip: { id: tripId } as any,
        },
        relations: ['trip', 'order'],
      });

      return byTrip ?? null;
    } catch (err) {
      // If order lookup fails or no trip relation, just return null (caller will fallback to order.platformCommissionAmount)
      return null;
    }
  }
  /**
   * Create a REFUND transaction (idempotent by caller if needed).
   *
   * Params:
   *  - orderId
   *  - driverId?: string | null
   *  - amount: positive number (gross)
   *  - currency
   *  - description?
   *  - metadata?: Record<string, any> (can include idempotencyKey)
   *  - status?: TransactionStatus (defaults to PENDING or PROCESSED)
   */
  async createRefund(
    manager: EntityManager,
    params: {
      orderId: string;
      driverId?: string | null;
      amount: number;
      currency: string;
      description?: string;
      metadata?: Record<string, any>;
      status?: TransactionStatus;
    },
  ): Promise<Transaction> {
    const repo = manager.getRepository(Transaction);
    const amt = _roundTo2(params.amount);
    if (!isFinite(amt) || amt <= 0) {
      throw new ConflictException('Refund amount must be a positive number.');
    }

    const tx = repo.create({
      type: TransactionType.REFUND,
      order: { id: params.orderId } as any,
      toUser: params.driverId ? ({ id: params.driverId } as any) : null,
      grossAmount: amt,
      platformFeeAmount: 0,
      netAmount: amt,
      currency: params.currency,
      status: params.status ?? TransactionStatus.PENDING,
      description: params.description ?? `refund for order ${params.orderId}`,
      processedAt:
        params.status === TransactionStatus.PROCESSED ? new Date() : null,
      metadata: params.metadata ?? null,
    } as DeepPartial<Transaction>);

    try {
      return await repo.save(tx);
    } catch (err: any) {
      // If unique constraint on some idempotency index exists, caller should re-query
      handleRepositoryError(this.logger, err, 'createRefund', this.entityName);
    }
  }
  /**
   * Atomically find-or-create a REFUND transaction for an order.
   *
   * - Locks the order row FOR UPDATE to serialize concurrent refund attempts for the same order.
   * - If a REFUND already exists for the order, returns it (created = false).
   * - Otherwise creates a new REFUND (using createRefund) and returns it (created = true).
   * - If a unique-constraint race occurs (23505) it will re-query and return the already-created tx.
   *
   * NOTE: this method assumes the business unit of concurrency is the order (one refund flow
   * serialized per order). If you allow multiple partial refunds you should adapt logic accordingly.
   */
  async findOrCreateRefundForOrderAtomic(
    manager: EntityManager,
    orderId: string,
    params: {
      amount: number;
      currency: string;
      driverId?: string | null;
      description?: string;
      metadata?: Record<string, any>;
      status?: TransactionStatus;
    },
  ): Promise<{ tx: Transaction; created: boolean }> {
    const txRepo = manager.getRepository(Transaction);

    // 1) lock order row to serialize concurrent refund attempts on same order
    try {
      const orderRow = await manager
        .getRepository('order')
        .createQueryBuilder('o')
        .setLock('pessimistic_write')
        .where('o.id = :orderId', { orderId })
        .getOne();

      if (!orderRow) {
        throw new NotFoundException(
          formatErrorResponse('ORDER_NOT_FOUND', 'Order not found', {
            orderId,
          }),
        );
      }
    } catch (err) {
      // rethrow NotFoundException or delegate other errors to handler
      if (err instanceof NotFoundException) throw err;
      handleRepositoryError(
        this.logger,
        err,
        'findOrCreateRefundForOrderAtomic (lock order)',
        this.entityName,
      );
    }

    // 2) check existing refund (already locked by order above, so safe)
    const existing = await this.findRefundByOrderId(manager, orderId);
    if (existing) return { tx: existing, created: false };

    // 3) try to create refund (may race with another process which has been waiting on the lock)
    try {
      const tx = await this.createRefund(manager, {
        orderId,
        driverId: params.driverId ?? null,
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        metadata: params.metadata ?? undefined,
        status: params.status ?? TransactionStatus.PENDING,
      });

      // createRefund uses repo.save and will throw on DB errors handled below
      return { tx: tx, created: true };
    } catch (err: any) {
      // If there's a unique-violation from DB-level idempotency, re-query the refund and return it
      if (err?.code === '23505') {
        const again = await this.findRefundByOrderId(manager, orderId);
        if (again) return { tx: again, created: false };
      }
      // otherwise surface the error consistently
      handleRepositoryError(
        this.logger,
        err,
        'findOrCreateRefundForOrderAtomic',
        this.entityName,
      );
    }

    // Should never reach here, but keep typing safe
    throw new Error('Unexpected flow in findOrCreateRefundForOrderAtomic');
  }

  /**
   * Sum of REFUND grossAmount (successful/pending) for a given order.
   * Useful to validate partial refunds do not exceed paid amount.
   */
  async sumRefundsByOrder(
    manager: EntityManager,
    orderId: string,
  ): Promise<number> {
    const qb = manager
      .getRepository(Transaction)
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.gross_amount),0)', 'total')
      .where('t.order_id = :orderId', { orderId })
      .andWhere('t.type = :type', { type: TransactionType.REFUND });

    const raw = await qb.getRawOne();
    return Number(raw?.total ?? 0);
  }
}
