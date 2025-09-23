import { forwardRef, Module } from '@nestjs/common';
import { DriverProfileService } from './services/driver-profile.service';
import { DriverProfileController } from './controllers/driver-profiles.controller';
import { DriverProfileRepository } from './repositories/driver-profile.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverProfile } from './entities/driver-profile.entity';
import { User } from '../user/entities/user.entity';
import { DriverBalanceModule } from '../driver_balance/driver_balance.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { UserModule } from '../user/user.module';
import { DriversAvailabilityModule } from '../drivers-availability/drivers-availability.module';
import { VehiclesModule } from '../vehicles/vehicles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DriverProfile, User]),
    DriverBalanceModule,
    TransactionsModule,
    UserModule,
    forwardRef(() => DriversAvailabilityModule),
    forwardRef(() => VehiclesModule),
  ],
  providers: [DriverProfileService, DriverProfileRepository],
  controllers: [DriverProfileController],
  exports: [DriverProfileRepository, DriverProfileService],
})
export class DriverProfilesModule {}
