// src/modules/payments/repositories/cash-collection-record.repository.ts
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
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import {
  CashCollectionRecord,
  CashCollectionStatus,
} from '../entities/cash_colletion_records.entity';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { formatErrorResponse } from 'src/common/utils/api-response.utils';
import { CashCollectionRecordFilterDto } from '../dto/cash-collection-record-filter.dto';

@Injectable()
export class CashCollectionRecordRepository extends Repository<CashCollectionRecord> {
  private readonly logger = new Logger(CashCollectionRecordRepository.name);
  private readonly entityName = 'CashCollectionRecord';

  constructor(dataSource: DataSource) {
    super(CashCollectionRecord, dataSource.createEntityManager());
  }

  async createAndSave(
    recordData: DeepPartial<CashCollectionRecord>,
    manager?: EntityManager,
  ): Promise<CashCollectionRecord> {
    const repo = manager ? manager.getRepository(CashCollectionRecord) : this;

    const record = repo.create(recordData);
    try {
      const savedRecord = await repo.save(record);

      // Recargar con relaciones para retornar el objeto completo
      return repo.findOne({
        where: { id: savedRecord.id },
        relations: ['driver', 'collectionPoint', 'collectedBy', 'transaction'],
      }) as Promise<CashCollectionRecord>;
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  async findById(id: string): Promise<CashCollectionRecord> {
    try {
      const record = await this.findOne({
        where: { id },
        relations: ['driver', 'collectionPoint', 'collectedBy', 'transaction'],
      });

      if (!record) {
        throw new NotFoundException(
          `${this.entityName} with id ${id} not found`,
        );
      }

      return record;
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }

  async findByIdOrNull(id: string): Promise<CashCollectionRecord | null> {
    try {
      return this.findOne({
        where: { id },
        relations: ['driver', 'collectionPoint', 'collectedBy', 'transaction'],
      });
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findByIdOrNull',
        this.entityName,
      );
    }
  }

  async findByTransactionId(
    transactionId: string,
  ): Promise<CashCollectionRecord> {
    try {
      const record = await this.findOne({
        where: { transaction: { id: transactionId } },
        relations: ['driver', 'collectionPoint', 'collectedBy', 'transaction'],
      });

      if (!record) {
        throw new NotFoundException(
          `${this.entityName} with transaction id ${transactionId} not found`,
        );
      }

      return record;
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      handleRepositoryError(
        this.logger,
        err,
        'findByTransactionId',
        this.entityName,
      );
    }
  }

  async updateStatus(
    id: string,
    status: CashCollectionStatus,
    manager?: EntityManager,
  ): Promise<CashCollectionRecord> {
    const repo = manager ? manager.getRepository(CashCollectionRecord) : this;

    try {
      await repo.update(id, { status });

      const updatedRecord = await repo.findOne({
        where: { id },
        relations: ['driver', 'collectionPoint', 'collectedBy', 'transaction'],
      });

      if (!updatedRecord) {
        throw new NotFoundException(
          `${this.entityName} with id ${id} not found after update`,
        );
      }

      return updatedRecord;
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      handleRepositoryError(this.logger, err, 'updateStatus', this.entityName);
    }
  }

  async findPendingRecords(): Promise<CashCollectionRecord[]> {
    try {
      return this.find({
        where: { status: CashCollectionStatus.PENDING },
        relations: ['driver', 'collectionPoint', 'collectedBy', 'transaction'],
        order: { createdAt: 'ASC' },
      });
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findPendingRecords',
        this.entityName,
      );
    }
  }
  async softDeleteRecord(id: string): Promise<void> {
    try {
      await this.softDelete(id);
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'softDeleteRecord',
        this.entityName,
      );
    }
  }
  async getTotalCollectedAmount(
    filters?: CashCollectionRecordFilterDto,
  ): Promise<number> {
    try {
      const qb = this.createQueryBuilder('record')
        .select('SUM(record.amount)', 'totalAmount')
        .where('record.status = :status', {
          status: CashCollectionStatus.COMPLETED,
        });

      if (filters) {
        this.applyAmountFilters(qb, filters);
      }

      const result = await qb.getRawOne();
      return parseFloat(result.totalAmount) || 0;
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'getTotalCollectedAmount',
        this.entityName,
      );
    }
  }
  private applyAmountFilters(
    qb: SelectQueryBuilder<CashCollectionRecord>,
    filters: CashCollectionRecordFilterDto,
  ): void {
    if (filters.driverId) {
      qb.andWhere('record.driver_id = :driverId', {
        driverId: filters.driverId,
      });
    }

    if (filters.collectorId) {
      qb.andWhere('record.collected_by_user_id = :collectorId', {
        collectorId: filters.collectorId,
      });
    }

    if (filters.collectionPointId) {
      qb.andWhere('record.collection_point_id = :collectionPointId', {
        collectionPointId: filters.collectionPointId,
      });
    }

    if (filters.currency) {
      qb.andWhere('record.currency = :currency', {
        currency: filters.currency,
      });
    }

    if (filters.startDate) {
      qb.andWhere('record.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      qb.andWhere('record.createdAt <= :endDate', {
        endDate: filters.endDate,
      });
    }
  }
  async createPending(
    manager: EntityManager,
    params: {
      driverId: string;
      collectionPointId: string;
      collectedByUserId: string;
      amount: number;
      currency: string;
      transaction: Transaction;
      notes?: string;
    },
  ): Promise<CashCollectionRecord> {
    const repo = manager.getRepository(CashCollectionRecord);
    const entity = repo.create({
      driver: { id: params.driverId } as any,
      collectionPoint: { id: params.collectionPointId } as any,
      collectedBy: { id: params.collectedByUserId } as any,
      amount: params.amount,
      currency: params.currency,
      status: CashCollectionStatus.PENDING,
      transaction: params.transaction,
      notes: params.notes ?? null,
    } as DeepPartial<CashCollectionRecord>);

    try {
      return await repo.save(entity);
    } catch (err: any) {
      // Unique por transaction (uq_ccr_transaction)
      if (err?.code === '23505') {
        throw new ConflictException(
          formatErrorResponse(
            'CCR_ALREADY_EXISTS',
            'Ya existe un CashCollectionRecord para esa transacción.',
            { transactionId: params.transaction.id },
          ),
        );
      }
      throw err;
    }
  }

  findByIdWithTx(manager: EntityManager, id: string) {
    return manager.getRepository(CashCollectionRecord).findOne({
      where: { id },
      relations: ['transaction', 'driver'],
    });
  }
  /**
   * Create an off-platform refund note as a CashCollectionRecord.
   *
   * This is intended for admin-driven cash refunds which are handled outside
   * the payments flow (no gateway refund). The record is created with amount=0
   * and status=COMPLETED to serve as an auditable note/support.
   *
   * Params:
   *  - manager: EntityManager (must be passed when called inside a tx)
   *  - params:
   *     - orderId?: string       (optional reference to the order being reversed)
   *     - driverId?: string      (driver for whom the refund applies)
   *     - adminId: string        (user performing the admin reversal)
   *     - note?: string          (optional free text)
   *     - currency?: string      (optional currency, default 'CUP')
   */
  async createOffPlatformRefundNote(
    manager: EntityManager,
    params: {
      collectionPointId: string;
      transactionId: string;
      orderId?: string;
      driverId?: string | null;
      adminId: string;
      note?: string | null;
      currency?: string | null;
    },
  ): Promise<CashCollectionRecord> {
    const repo = manager.getRepository(CashCollectionRecord);
    const currency = params.currency ?? 'CUP';
    const now = new Date();

    const composedNoteParts: string[] = [];
    composedNoteParts.push(`off-platform refund note`);
    if (params.orderId) composedNoteParts.push(`order:${params.orderId}`);
    composedNoteParts.push(`admin:${params.adminId}`);
    composedNoteParts.push(`at:${now.toISOString()}`);
    if (params.note) composedNoteParts.push(`note:${params.note}`);

    const entity = repo.create({
      driver: params.driverId ? ({ id: params.driverId } as any) : null,
      collectionPoint: { id: params.collectionPointId } as any,
      transaction: { id: params.transactionId } as any,
      collectedBy: params.adminId ? ({ id: params.adminId } as any) : null,
      amount: 0,
      currency,
      status: CashCollectionStatus.COMPLETED,
      notes: composedNoteParts.join(' | '),
    } as DeepPartial<CashCollectionRecord>);

    try {
      const saved = await repo.save(entity);
      return (await repo.findOne({
        where: { id: saved.id },
        relations: ['driver', 'collectionPoint', 'collectedBy', 'transaction'],
      })) as CashCollectionRecord;
    } catch (err: any) {
      // Unique constraint on transaction shouldn't trigger here (transaction is null),
      // but still use generic error handling for consistency.
      if (err?.code === '23505') {
        throw new ConflictException(
          formatErrorResponse(
            'CCR_CONFLICT',
            'Conflict creating off-platform refund note.',
            { orderId: params.orderId, adminId: params.adminId },
          ),
        );
      }
      handleRepositoryError(
        this.logger,
        err,
        'createOffPlatformRefundNote',
        this.entityName,
      );
    }
  }
}
