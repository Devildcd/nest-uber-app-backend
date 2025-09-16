import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trip } from '../trip/entities/trip.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { DriverAvailability } from './entities/driver-availability.entity';
import { DriverAvailabilityController } from './controllers/driver-availability.controller';
import { DriverAvailabilityService } from './services/driver-availability.service';
import { DriverAvailabilityRepository } from './repositories/driver-availability.repository';
import { UserRepository } from '../user/repositories/user.repository';
import { User } from '../user/entities/user.entity';
import { VehicleRepository } from '../vehicles/repositories/vehicle.repository';
import { DriverProfileRepository } from '../driver-profiles/repositories/driver-profile.repository';
import { DriverBalance } from '../driver_balance/entities/driver_balance.entity';
import { DriverBalanceModule } from '../driver_balance/driver_balance.module';
import { DataSource } from 'typeorm';
import { DriverProfile } from '../driver-profiles/entities/driver-profile.entity';
import { DriverBalanceService } from '../driver_balance/services/driver_balance.service';
import { DriverBalanceRepository } from '../driver_balance/repositories/driver_balance.repository';
import { WalletMovementsRepository } from '../wallet-movements/repositories/wallet-movements.repository';
import { WalletMovement } from '../wallet-movements/entities/wallet-movement.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionRepository } from '../transactions/repositories/transactions.repository';
import { CashCollectionPoint } from '../cash_colletions_points/entities/cash_colletions_points.entity';
import { CashCollectionPointRepository } from '../cash_colletions_points/repositories/cash_colletion_points.repository';
import { CashCollectionRecord } from '../cash_colletion_records/entities/cash_colletion_records.entity';
import { CashCollectionRecordRepository } from '../cash_colletion_records/repositories/cash_colletion_records.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DriverAvailability,
      Trip,
      Vehicle,
      User,
      DriverProfile,
      DriverBalance,
      WalletMovement,
      Transaction,
      CashCollectionPoint,
      CashCollectionRecord,
    ]),

    DriverBalanceModule,
  ],
  controllers: [DriverAvailabilityController],
  providers: [
    DriverAvailabilityService,
    {
      provide: DriverAvailabilityRepository,
      useFactory: (ds: DataSource) => new DriverAvailabilityRepository(ds),
      inject: [DataSource],
    },
    {
      provide: UserRepository,
      useFactory: (ds: DataSource) => new UserRepository(ds),
      inject: [DataSource],
    },
    {
      provide: DriverProfileRepository,
      useFactory: (ds: DataSource) => new DriverProfileRepository(ds),
      inject: [DataSource],
    },
    {
      provide: VehicleRepository,
      useFactory: (ds: DataSource) => new VehicleRepository(ds),
      inject: [DataSource],
    },
    DriverBalanceService,
    DriverBalanceRepository,
    WalletMovementsRepository,
    TransactionRepository,
    CashCollectionPointRepository,
    CashCollectionRecordRepository,
  ],
  exports: [
    DriverAvailabilityService,
    DriverAvailabilityRepository, // si lo necesitas desde VehiclesService
  ],
})
export class DriversAvailabilityModule {}
