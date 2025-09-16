import { Module } from '@nestjs/common';
import { OrdersController } from './controllers/orders.controller';
import { OrdersService } from './services/orders.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Trip } from '../trip/entities/trip.entity';
import { OrderRepository } from './repositories/order.repository';
import { Order } from './entities/order.entity';
import { DriverBalanceService } from '../driver_balance/services/driver_balance.service';
import { TransactionRepository } from '../transactions/repositories/transactions.repository';
import { DriverBalanceRepository } from '../driver_balance/repositories/driver_balance.repository';
import { WalletMovementsRepository } from '../wallet-movements/repositories/wallet-movements.repository';
import { CashCollectionPoint } from '../cash_colletions_points/entities/cash_colletions_points.entity';
import { CashCollectionPointRepository } from '../cash_colletions_points/repositories/cash_colletion_points.repository';
import { CashCollectionRecordRepository } from '../cash_colletion_records/repositories/cash_colletion_records.repository';
import { CashCollectionRecord } from '../cash_colletion_records/entities/cash_colletion_records.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      Trip,
      User,
      CashCollectionPoint,
      CashCollectionRecord,
    ]),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderRepository,
    DriverBalanceService,
    TransactionRepository,
    DriverBalanceRepository,
    WalletMovementsRepository,
    CashCollectionPointRepository,
    CashCollectionRecordRepository,
  ],
})
export class OrdersModule {}
