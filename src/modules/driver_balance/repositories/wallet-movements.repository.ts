// src/modules/wallets/repositories/wallet-movements.repository.ts
import {
  BadRequestException,
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
import { WalletMovement } from '../entities/wallet-movement.entity';
import { handleRepositoryError } from '../../../common/utils/handle-repository-error';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { WalletMovementQueryDto } from '../dto/wallet-movements-query.dto';
import { formatErrorResponse } from 'src/common/utils/api-response.utils';
import { DriverBalance } from '../entities/driver_balance.entity';

export type CreateAndSaveMovementOpts = {
  transactionId?: string | null;
  note?: string | null;
  // Si true: el método bloqueará la wallet, calculará previous/new balances, guardará movement y actualizará wallet.
  // Requiere walletId y amount.
  autoApplyToWallet?: boolean;
  // Si autoApplyToWallet = false, puedes pasar previousBalance/newBalance en payload
};

@Injectable()
export class WalletMovementsRepository extends Repository<WalletMovement> {
  private readonly logger = new Logger(WalletMovementsRepository.name);
  private readonly entityName = 'WalletMovement';

  constructor(private dataSource: DataSource) {
    super(WalletMovement, dataSource.createEntityManager());
  }
  /**
   * Crea y guarda un WalletMovement.
   * manager: EntityManager transaccional (OBLIGATORIO).
   */
  async createAndSave(
    manager: EntityManager,
    params: {
      walletId: string;
      amount: number;
      previousBalance: number;
      newBalance: number;
      transactionId?: string | null;
      note?: string;
    },
  ): Promise<WalletMovement> {
    // create movement
    const movementRepo = manager.getRepository(WalletMovement);
    const movement = movementRepo.create({
      wallet: { id: params.walletId } as any,
      amount: params.amount,
      newBalance: params.newBalance,
      previousBalance: params.previousBalance,
      transactionId: params.transactionId ?? null,
      note: params.note ?? null,
    } as DeepPartial<WalletMovement>);
    try {
      return await movementRepo.save(movement);
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'createAndSave',
        'WalletMovement',
      );
    }
  }

  async findByTransactionId(
    transactionId: string,
    manager: EntityManager,
  ): Promise<WalletMovement | null> {
    try {
      return manager.findOne(WalletMovement, { where: { transactionId } });
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findByTransactionId',
        this.entityName,
      );
    }
  }
  /**
   * Último movimiento del wallet del driver.
   */
  async findLastByDriverId(driverId: string): Promise<WalletMovement | null> {
    return this.createQueryBuilder('m')
      .innerJoin('m.wallet', 'w', 'w.driverId = :driverId', { driverId })
      .orderBy('m.createdAt', 'DESC')
      .limit(1)
      .getOne();
  }

  /** Listado paginado con entidades (siguiendo misma línea que availability) */
  async findAllPaginated(
    pagination: PaginationDto,
    walletId: string,
    filters?: WalletMovementQueryDto,
  ): Promise<[WalletMovement[], number]> {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      // 2) Armado de QB (alias 'm'), filtra por wallet en el WHERE base
      const qb: SelectQueryBuilder<WalletMovement> = this.createQueryBuilder(
        'm',
      )
        .leftJoin('m.wallet', 'w')
        .where('w.id = :walletId', { walletId })
        .orderBy('m.createdAt', 'DESC') // snake_case para evitar sorpresas con TypeORM
        .skip(skip)
        .take(limit);

      if (filters) {
        this.applyFilters(qb, filters);
      }
      console.log(qb.getSql()); // Muestra la consulta SQL con parámetros nombrados
      console.log(qb.getParameters()); // Muestra los valores de los parámetros

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

  // ---------- filtros ----------
  private applyFilters(
    qb: SelectQueryBuilder<WalletMovement>,
    f: WalletMovementQueryDto,
  ): void {
    if (f.transactionId) {
      qb.andWhere('m.transaction_id = :tx', { tx: f.transactionId });
    }
    if (f.from) {
      qb.andWhere('m.createdAt >= :from', { from: f.from });
    }
    if (f.to) {
      qb.andWhere('m.createdAt <= :to', { to: f.to });
    }
    if (f.search) {
      qb.andWhere('m.note ILIKE :s', { s: `%${f.search}%` });
    }
  }
}
