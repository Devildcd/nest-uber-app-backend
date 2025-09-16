import { Module } from '@nestjs/common';
import { CashColletionsPointsController } from './controllers/cash_colletions_points.controller';
import { CashColletionsPointsService } from './services/cash_colletions_points.service';

@Module({
  controllers: [CashColletionsPointsController],
  providers: [CashColletionsPointsService],
})
export class CashColletionsPointsModule {}
