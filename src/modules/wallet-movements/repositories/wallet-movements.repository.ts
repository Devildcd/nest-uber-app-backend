// src/modules/wallets/repositories/wallet-movements.repository.ts
import { BadRequestException, Logger } from '@nestjs/common';
import { DataSource, DeepPartial, EntityManager, Repository } from 'typeorm';
import { WalletMovement } from '../../wallet-movements/entities/wallet-movement.entity';
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

  constructor(dataSource: DataSource) {
    super(WalletMovement, dataSource?.createEntityManager());
  }
  /**
   * Crea y guarda un WalletMovement.
   * manager: EntityManager transaccional (OBLIGATORIO).
   */
  async createAndSave(
    manager: EntityManager,
    movementLike: DeepPartial<WalletMovement>,
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
    const movement = movementRepo.create(movementLike);
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

  findByTransactionId(transactionId: string) {
    return this.findOne({ where: { transactionId } });
  }
}
