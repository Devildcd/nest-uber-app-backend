import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trip } from '../trip/entities/trip.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { DriverAvailability } from './entities/driver-availability.entity';
import { DriverAvailabilityController } from './controllers/driver-availability.controller';
import { DriverAvailabilityService } from './services/driver-availability.service';
import { DriverAvailabilityRepository } from './repositories/driver-availability.repository';
import { User } from '../user/entities/user.entity';
import { DriverBalanceModule } from '../driver_balance/driver_balance.module';
import { DriverProfilesModule } from '../driver-profiles/driver-profiles.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { CashColletionsPointsModule } from '../cash_colletions_points/cash_colletions_points.module';
import { UserModule } from '../user/user.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { PresenceSweeperJob } from '../../core/domain/jobs/presence-sweeper.job';
import { DriverLocationService } from './services/driver-location.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DriverAvailability, Trip, Vehicle, User]),
    UserModule,
    DriverBalanceModule,
    forwardRef(() => DriverProfilesModule),
    TransactionsModule,
    CashColletionsPointsModule,
    forwardRef(() => VehiclesModule),
  ],
  controllers: [DriverAvailabilityController],
  providers: [
    DriverAvailabilityService,
    DriverAvailabilityRepository,
    PresenceSweeperJob,
    DriverLocationService,
  ],
  exports: [
    DriverAvailabilityService,
    DriverAvailabilityRepository,
    DriverLocationService,
  ],
})
export class DriversAvailabilityModule {}
