import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions/controllers/transactions.controller';
import { TransactionsService } from './transactions/services/transactions.service';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService]
})
export class TransactionsModule {}
