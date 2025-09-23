import { Module } from '@nestjs/common';
import { TransactionsController } from './controllers/transactions.controller';
import { TransactionsService } from './services/transactions.service';
import { TransactionRepository } from './repositories/transactions.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { Trip } from '../trip/entities/trip.entity';
import { Order } from '../orders/entities/order.entity';
import { User } from '../user/entities/user.entity';
import { TripRepository } from '../trip/repositories/trip.repository';
import { UserRepository } from '../user/repositories/user.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, User, Order, Trip])],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionRepository],
  exports: [TransactionRepository, TransactionsService],
})
export class TransactionsModule {}
