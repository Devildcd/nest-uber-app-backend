import { Module } from '@nestjs/common';
import { DriverBalanceController } from './controllers/driver_balance.controller';
import { DriverBalanceService } from './services/driver_balance.service';
import { WalletsStatusController } from './controllers/driver-balance-status.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverBalance } from './entities/driver_balance.entity';
import { DriverBalanceRepository } from './repositories/driver_balance.repository';
import { DataSource } from 'typeorm';
import { TransactionRepository } from '../transactions/repositories/transactions.repository';
import { WalletMovementsRepository } from '../wallet-movements/repositories/wallet-movements.repository';
import { WalletMovement } from '../wallet-movements/entities/wallet-movement.entity';
import { CashCollectionPoint } from '../cash_colletions_points/entities/cash_colletions_points.entity';
import { CashCollectionRecord } from '../cash_colletion_records/entities/cash_colletion_records.entity';
import { CashCollectionPointRepository } from '../cash_colletions_points/repositories/cash_colletion_points.repository';
import { CashCollectionRecordRepository } from '../cash_colletion_records/repositories/cash_colletion_records.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DriverBalance,
      WalletMovement,
      CashCollectionPoint,
      CashCollectionRecord,
    ]),
  ],
  controllers: [DriverBalanceController, WalletsStatusController],
  providers: [
    DriverBalanceService,
    {
      provide: DriverBalanceRepository,
      useFactory: (ds: DataSource) => new DriverBalanceRepository(ds),
      inject: [DataSource],
    },
    {
      provide: TransactionRepository,
      useFactory: (ds: DataSource) => new TransactionRepository(ds),
      inject: [DataSource],
    },
    WalletMovementsRepository,
    CashCollectionPointRepository,
    CashCollectionRecordRepository,
  ],
})
export class DriverBalanceModule {}
