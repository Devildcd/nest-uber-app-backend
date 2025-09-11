import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  QueryFailedError,
  QueryRunner,
} from 'typeorm';

import { Transaction } from '../entities/transaction.entity';
import { TransactionRepository } from '../repositories/transactions.repository';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { TransactionFiltersDto } from '../dto/transaction-filters.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import {
  formatErrorResponse,
  formatSuccessResponse,
  handleServiceError,
} from 'src/common/utils/api-response.utils';

import { TransactionListItemDto } from '../dto/transaction-list-item.dto';
import { TransactionDataDto } from '../dto/transaction-data.dto';

import { Order } from '../../orders/entities/order.entity';
import { Trip } from '../../trip/entities/trip.entity';
import { User } from '../../user/entities/user.entity';
import { TripRepository } from 'src/modules/trip/repositories/trip.repository';
import { TransactionDetailDto } from '../dto/transaction-detail.dto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly repo: TransactionRepository,
    private readonly tripRepository: TripRepository,
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------
  // CREATE
  // ------------------------------
  async create(
    dto: CreateTransactionDto,
  ): Promise<ApiResponse<TransactionDetailDto>> {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate optional relations inside the same transaction
      let order: Order | null = null;
      let trip: Trip | null = null;
      let fromUser: User | null = null;
      let toUser: User | null = null;

      if (dto.orderId) {
        order = await queryRunner.manager.findOne(Order, { where: { id: dto.orderId } });
        if (!order) throw new NotFoundException(`Order ${dto.orderId} not found`);
      }

      if (dto.tripId) {
        trip = await queryRunner.manager.findOne(Trip, { where: { id: dto.tripId } });
        if (!trip) throw new NotFoundException(`Trip ${dto.tripId} not found`);
      }

      if (dto.fromUserId) {
        fromUser = await queryRunner.manager.findOne(User, { where: { id: dto.fromUserId } });
        if (!fromUser) throw new NotFoundException(`From user ${dto.fromUserId} not found`);
      }

      if (dto.toUserId) {
        toUser = await queryRunner.manager.findOne(User, { where: { id: dto.toUserId } });
        if (!toUser) throw new NotFoundException(`To user ${dto.toUserId} not found`);
      }

      const partial: Partial<Transaction> = {
        type: dto.type,
        grossAmount: dto.grossAmount,
        platformFeeAmount: dto.platformFeeAmount ?? 0,
        netAmount: dto.netAmount,
        currency: dto.currency,
        status: dto.status,
        description: dto.description,
        metadata: dto.metadata,
        processedAt: dto.processedAt ? new Date(dto.processedAt) : undefined,
        order: order ?? undefined,
        trip: trip ?? undefined,
        fromUser: fromUser ?? undefined,
        toUser: toUser ?? undefined,
      };

      const created = await this.repo.createAndSave(partial, queryRunner.manager);

      await queryRunner.commitTransaction();

      const saved = await this.repo.findById(created.id);
      if (!saved) {
        throw new NotFoundException('Transaction not found after creation');
      }

      return formatSuccessResponse<TransactionDetailDto>(
        'Transaction created successfully',
        this.toDetailDto(saved),
      );
    } catch (error: any) {
      await queryRunner.rollbackTransaction();

      if (error instanceof QueryFailedError) {
        const pgErr = error.driverError as { code?: string; detail?: string };
        if (pgErr?.code === '23505') {
          return formatErrorResponse<TransactionDetailDto>(
            'Resource conflict',
            'CONFLICT_ERROR',
            pgErr.detail,
          );
        }
      }

      if (error instanceof NotFoundException) {
        return formatErrorResponse<TransactionDetailDto>(
          'Resource not found',
          'NOT_FOUND',
          error.message,
        );
      }

      if (error instanceof BadRequestException) {
        return formatErrorResponse<TransactionDetailDto>(
          'Invalid request',
          'BAD_REQUEST',
          error.message,
        );
      }

      return handleServiceError<TransactionDetailDto>(
        this.logger,
        error,
        'TransactionsService.create',
      );
    } finally {
      await queryRunner.release();
    }
  }

  // ------------------------------
  // FIND ALL (PAGINATED)
  // ------------------------------
  async findAll(
    pagination: PaginationDto,
    filters?: TransactionFiltersDto,
  ): Promise<ApiResponse<TransactionListItemDto[]>> {
    try {
      const [items, total] = await this.repo.findAllPaginated(pagination, filters);

      const mapped = (items ?? []).map((t) => this.toListItemDto(t));

      return formatSuccessResponse<TransactionListItemDto[]>(
        'Transactions retrieved successfully',
        mapped,
        { total, page: pagination.page ?? 1, limit: pagination.limit ?? 20 },
      );
    } catch (error: any) {
      this.logger.error('findAll failed', error instanceof Error ? error.stack : String(error));
      return formatErrorResponse<TransactionListItemDto[]>(
        'Error fetching transactions',
        'FIND_ALL_ERROR',
        error,
      );
    }
  }

  // ------------------------------
  // FIND BY ID (DETAIL)
  // ------------------------------
  async findById(id: string): Promise<ApiResponse<TransactionDetailDto>> {
    try {
      const tx = await this.repo.findById(id);
      if (!tx) {
        return formatErrorResponse<TransactionDetailDto>('Transaction not found', 'NOT_FOUND');
      }
      return formatSuccessResponse<TransactionDetailDto>(
        'Transaction retrieved successfully',
        this.toDetailDto(tx),
      );
    } catch (error: any) {
      this.logger.error('findById failed', error instanceof Error ? error.stack : String(error));
      return formatErrorResponse<TransactionDetailDto>(
        'Error fetching transaction',
        'FIND_BY_ID_ERROR',
        error,
      );
    }
  }

  // ------------------------------
  // UPDATE
  // ------------------------------
  async update(
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<ApiResponse<TransactionDetailDto>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await this.repo.findWithRelations(id, ['fromUser', 'toUser', 'order', 'trip'], undefined, queryRunner.manager);
      if (!existing) throw new NotFoundException(`Transaction ${id} not found`);

      // If DTO contains relation ids, validate and set
      if ((dto as any).orderId !== undefined) {
        if (dto.orderId) {
          const order = await queryRunner.manager.findOne(Order, { where: { id: dto.orderId } });
          if (!order) throw new NotFoundException(`Order ${dto.orderId} not found`);
          existing.order = order;
        } else {
          existing.order = null;
        }
      }

      if ((dto as any).tripId !== undefined) {
        if (dto.tripId) {
          const trip = await queryRunner.manager.findOne(Trip, { where: { id: dto.tripId } });
          if (!trip) throw new NotFoundException(`Trip ${dto.tripId} not found`);
          existing.trip = trip;
        } else {
          existing.trip = null;
        }
      }

      if ((dto as any).fromUserId !== undefined) {
        if (dto.fromUserId) {
          const fu = await queryRunner.manager.findOne(User, { where: { id: dto.fromUserId } });
          if (!fu) throw new NotFoundException(`From user ${dto.fromUserId} not found`);
          existing.fromUser = fu;
        } else {
          existing.fromUser = null;
        }
      }

      if ((dto as any).toUserId !== undefined) {
        if (dto.toUserId) {
          const tu = await queryRunner.manager.findOne(User, { where: { id: dto.toUserId } });
          if (!tu) throw new NotFoundException(`To user ${dto.toUserId} not found`);
          existing.toUser = tu;
        } else {
          existing.toUser = null;
        }
      }

      // Update scalar fields explicitly (avoid blind Object.assign)
      if (dto.type !== undefined) existing.type = dto.type;
      if (dto.grossAmount !== undefined) existing.grossAmount = dto.grossAmount;
      if (dto.platformFeeAmount !== undefined) existing.platformFeeAmount = dto.platformFeeAmount;
      if (dto.netAmount !== undefined) existing.netAmount = dto.netAmount;
      if (dto.currency !== undefined) existing.currency = dto.currency;
      if (dto.status !== undefined) existing.status = dto.status;
      if (dto.processedAt !== undefined) existing.processedAt = dto.processedAt ? new Date(dto.processedAt) : undefined;
      if (dto.description !== undefined) existing.description = dto.description;
      if (dto.metadata !== undefined) existing.metadata = dto.metadata;

      const updated = await queryRunner.manager.save(Transaction, existing);
      await queryRunner.commitTransaction();

      return formatSuccessResponse<TransactionDetailDto>(
        'Transaction updated successfully',
        this.toDetailDto(updated),
      );
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();

      if (error instanceof QueryFailedError) {
        const dbError = error.driverError as { code?: string; detail?: string };
        if (dbError.code === '23505') {
          return formatErrorResponse<TransactionDetailDto>(
            'Transaction conflict',
            'CONFLICT_ERROR',
            dbError.detail,
          );
        }
      }

      if (error instanceof NotFoundException) {
        return formatErrorResponse<TransactionDetailDto>(error.message, 'NOT_FOUND');
      }

      const err = error as Error;
      this.logger.error(`update failed for Transaction ${id}`, err.stack);
      return formatErrorResponse<TransactionDetailDto>(
        'Failed to update transaction',
        err.name,
      );
    } finally {
      await queryRunner.release();
    }
  }

  // ------------------------------
  // REMOVE (soft)
  // ------------------------------
  async remove(id: string): Promise<ApiResponse<null>> {
    try {
      await this.repo.softDeleteTransaction(id);
      return formatSuccessResponse<null>('Transaction deleted successfully', null);
    } catch (err: any) {
      this.logger.error('remove failed', err instanceof Error ? err.stack : String(err));

      if (err instanceof QueryFailedError) {
        const pgErr = err.driverError as { code?: string; detail?: string };
        return formatErrorResponse<null>('Database error deleting transaction', pgErr.code, pgErr.detail);
      }

      return formatErrorResponse<null>('Error deleting transaction', err instanceof Error ? err.message : 'DELETE_ERROR', err);
    }
  }

  // ------------------------------
  // HELPERS: mapping to DTOs
  // ------------------------------
  private toListItemDto(tx: Transaction): TransactionListItemDto {
    return {
      id: tx.id,
      type: tx.type,
      grossAmount: tx.grossAmount,
      netAmount: tx.netAmount,
      platformFeeAmount: tx.platformFeeAmount,
      currency: tx.currency,
      status: tx.status,
      fromUserId: tx.fromUser?.id ?? undefined,
      toUserId: tx.toUser?.id ?? undefined,
      createdAt: tx.createdAt?.toISOString(),
      updatedAt: tx.updatedAt?.toISOString(),
    } as TransactionListItemDto;
  }

  private toDetailDto(tx: Transaction): TransactionDetailDto {
    return {
      id: tx.id,
      type: tx.type,
      grossAmount: tx.grossAmount,
      platformFeeAmount: tx.platformFeeAmount,
      netAmount: tx.netAmount,
      currency: tx.currency,
      status: tx.status,
      description: tx.description,
      processedAt: tx.processedAt ? tx.processedAt.toISOString() : undefined,
      orderId: tx.order?.id ?? undefined,
      tripId: tx.trip?.id ?? undefined,
      fromUserId: tx.fromUser?.id ?? undefined,
      fromUserName: tx.fromUser?.name ?? undefined,
      toUserId: tx.toUser?.id ?? undefined,
      toUserName: tx.toUser?.name ?? undefined,
      metadata: tx.metadata ?? undefined,
      createdAt: tx.createdAt?.toISOString(),
      updatedAt: tx.updatedAt?.toISOString(),
      deletedAt: tx.deletedAt ? tx.deletedAt.toISOString() : undefined,
    } as TransactionDetailDto;
  }

  private toDataDto(tx: Transaction): TransactionDataDto {
    return {
      id: tx.id,
      type: tx.type,
      grossAmount: tx.grossAmount,
      platformFeeAmount: tx.platformFeeAmount,
      netAmount: tx.netAmount,
      currency: tx.currency,
      status: tx.status,
      description: tx.description,
      metadata: tx.metadata,
      processedAt: tx.processedAt ? tx.processedAt.toISOString() : undefined,
      createdAt: tx.createdAt ? tx.createdAt.toISOString() : undefined,
      updatedAt: tx.updatedAt ? tx.createdAt.toISOString() : undefined,
    } as TransactionDataDto;
  }

}
