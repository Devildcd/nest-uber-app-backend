// prepaid-plans/prepaid-plans.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrepaidPlan } from './entities/prepaid-plans.entity';
import { PrepaidPlansController } from '../prepaid-plans/controllers/prepaid-plans.controller';
import { PrepaidPlansService } from '../prepaid-plans/services/prepaid-plans.service';
import { PrepaidPlanRepository } from '../prepaid-plans/repositories/prepaid-plans.repository';
import { UserPrepaidPlan } from './entities/user-prepaid-plans.entity';
import { TransactionsModule } from "../transactions/transactions.module";
import { CashColletionsPointsModule } from "../cash_colletions_points/cash_colletions_points.module";
import { Transaction } from '../transactions/entities/transaction.entity';
import { CashCollectionPoint } from '../cash_colletions_points/entities/cash_colletions_points.entity';
import { UserPrepaidPlanRepository } from './repositories/user-prepaid-plans.repository';
import { DriverBalance } from '../driver_balance/entities/driver_balance.entity';
import { WalletMovement } from '../driver_balance/entities/wallet-movement.entity';
import { DriverBalanceModule } from '../driver_balance/driver_balance.module';

@Module({
  imports: [TypeOrmModule.forFeature([PrepaidPlan, UserPrepaidPlan, Transaction, CashCollectionPoint, DriverBalance, WalletMovement]),
TransactionsModule,CashColletionsPointsModule, DriverBalanceModule],
  controllers: [PrepaidPlansController],
  providers: [PrepaidPlansService, PrepaidPlanRepository, UserPrepaidPlanRepository],
  exports: [PrepaidPlansService, PrepaidPlanRepository],
})
export class PrepaidPlansModule {}
