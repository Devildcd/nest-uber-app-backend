// src/modules/wallets/repositories/wallet-movements.repository.ts
import { BadRequestException, Logger } from '@nestjs/common';
import { DataSource, DeepPartial, EntityManager, Repository } from 'typeorm';
import { WalletMovement } from '../entities/wallet-movement.entity';
import { handleRepositoryError } from '../../../common/utils/handle-repository-error';

export type CreateAndSaveMovementOpts = {
  transactionId?: string | null;
  note?: string | null;
  // Si true: el método bloqueará la wallet, calculará previous/new balances, guardará movement y actualizará wallet.
  // Requiere walletId y amount.
  autoApplyToWallet?: boolean;
  // Si autoApplyToWallet = false, puedes pasar previousBalance/newBalance en payload
};

export class WalletMovementsRepository extends Repository<WalletMovement> {
  private readonly logger = new Logger(WalletMovementsRepository.name);
  private readonly entityName = 'WalletMovement';

  constructor(dataSource: DataSource) {
    super(WalletMovement, dataSource?.createEntityManager());
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
    if (!manager) {
      throw new BadRequestException(
        'EntityManager is required and must be transactional',
      );
    }
    const qr = manager.queryRunner;
    if (!qr || !qr.isTransactionActive) {
      throw new BadRequestException(
        'The provided EntityManager must be used inside an active transaction',
      );
    }
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
}
