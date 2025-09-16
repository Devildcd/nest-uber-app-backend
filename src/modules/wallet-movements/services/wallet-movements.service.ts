import { Injectable, Logger } from '@nestjs/common';
import { WalletMovementsRepository } from '../repositories/wallet-movements.repository';
import { DataSource } from 'typeorm';
import { CreateWalletMovementDto } from '../dto/create-wallet-movements.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';

@Injectable()
export class WalletMovementsService {
  private readonly logger = new Logger(WalletMovementsService.name);

  constructor(
    private readonly repo: WalletMovementsRepository,
    private readonly dataSource: DataSource,
  ) {}
}
