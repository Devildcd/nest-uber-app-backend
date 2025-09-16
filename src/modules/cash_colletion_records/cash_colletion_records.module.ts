import { Module } from '@nestjs/common';
import { CashColletionRecordsController } from './controllers/cash_colletion_records.controller';
import { CashColletionRecordsService } from './services/cash_colletion_records.service';

@Module({
  controllers: [CashColletionRecordsController],
  providers: [CashColletionRecordsService],
})
export class CashColletionRecordsModule {}
