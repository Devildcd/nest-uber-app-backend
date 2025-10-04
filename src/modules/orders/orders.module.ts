import { Module } from '@nestjs/common';
import { OrdersController } from './controllers/orders.controller';
import { OrdersService } from './services/orders.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Trip } from '../trip/entities/trip.entity';
import { OrderRepository } from './repositories/order.repository';
import { CommissionAdjustmentRepository } from './repositories/commission-adjustment.repository';
import { Order } from './entities/order.entity';
import { CommissionAdjustment } from './entities/comission-adjustment.entity';
import { DriverBalanceModule } from '../driver_balance/driver_balance.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { CashColletionsPointsModule } from '../cash_colletions_points/cash_colletions_points.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Trip, User, CommissionAdjustment]),
    DriverBalanceModule,
    TransactionsModule,
    CashColletionsPointsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderRepository, CommissionAdjustmentRepository],
  exports: [OrdersService, OrderRepository],
})
export class OrdersModule {}
