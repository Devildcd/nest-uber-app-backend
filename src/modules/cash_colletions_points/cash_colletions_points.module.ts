import { Module } from '@nestjs/common';
import { CashCollectionPointController } from './controllers/cash_colletions_points.controller';
import { CashColletionsPointsService } from './services/cash_colletions_points.service';
import { CashCollectionPointRepository } from './repositories/cash_colletion_points.repository';
import { CashCollectionPoint } from './entities/cash_colletions_points.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashCollectionRecord } from './entities/cash_colletion_records.entity';
import { CashCollectionRecordRepository } from './repositories/cash_colletion_records.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([CashCollectionPoint, CashCollectionRecord]),
  ],
  controllers: [CashCollectionPointController],
  providers: [
    CashColletionsPointsService,
    CashCollectionPointRepository,
    CashCollectionRecordRepository,
  ],
  exports: [
    CashCollectionPointRepository,
    CashColletionsPointsService,
    CashCollectionRecordRepository,
  ],
})
export class CashColletionsPointsModule {}
