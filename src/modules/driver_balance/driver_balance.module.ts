import { Module } from '@nestjs/common';
import { DriverBalanceController } from './controllers/driver_balance.controller';
import { DriverBalanceService } from './services/driver_balance.service';
import { WalletsStatusController } from './controllers/driver-balance-status.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverBalance } from './entities/driver_balance.entity';
import { DriverBalanceRepository } from './repositories/driver_balance.repository';
import { DataSource } from 'typeorm';
import { TransactionRepository } from '../transactions/repositories/transactions.repository';
import { WalletMovementsRepository } from './repositories/wallet-movements.repository';
import { WalletMovement } from './entities/wallet-movement.entity';
import { CashCollectionPoint } from '../cash_colletions_points/entities/cash_colletions_points.entity';
import { CashCollectionRecord } from '../cash_colletions_points/entities/cash_colletion_records.entity';
import { CashCollectionPointRepository } from '../cash_colletions_points/repositories/cash_colletion_points.repository';
import { CashCollectionRecordRepository } from '../cash_colletions_points/repositories/cash_colletion_records.repository';
import { User } from '../user/entities/user.entity';
import { TransactionsModule } from '../transactions/transactions.module';
import { CashColletionsPointsModule } from '../cash_colletions_points/cash_colletions_points.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DriverBalance, WalletMovement, User]),
    TransactionsModule,
    CashColletionsPointsModule,
    CashColletionsPointsModule,
  ],
  controllers: [DriverBalanceController, WalletsStatusController],
  providers: [
    DriverBalanceService,
    DriverBalanceRepository,
    WalletMovementsRepository,
  ],
  exports: [
    DriverBalanceRepository,
    DriverBalanceService,
    WalletMovementsRepository,
  ],
})
export class DriverBalanceModule {}
