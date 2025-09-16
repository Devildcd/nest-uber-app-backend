import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { VehicleType } from '../vehicle-types/entities/vehicle-types.entity';
import { DriverProfile } from '../driver-profiles/entities/driver-profile.entity';
import { VehicleRepository } from './repositories/vehicle.repository';
import { VehicleTypeRepository } from '../vehicle-types/repositories/vehicle-types.repository';
import { DriverProfileRepository } from '../driver-profiles/repositories/driver-profile.repository';
import { VehicleController } from './controllers/vehicle.controller';
import { VehiclesService } from './services/vehicles.service';
import { User } from '../user/entities/user.entity';
import { UserRepository } from '../user/repositories/user.repository';
import { DataSource } from 'typeorm';
import { DriverAvailabilityRepository } from '../drivers-availability/repositories/driver-availability.repository';
import { DriverAvailabilityService } from '../drivers-availability/services/driver-availability.service';
import { DriversAvailabilityModule } from '../drivers-availability/drivers-availability.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vehicle, VehicleType, DriverProfile, User]),
    forwardRef(() => DriversAvailabilityModule),
  ],
  controllers: [VehicleController],
  providers: [
    VehiclesService,
    VehiclesService,
    {
      provide: VehicleRepository,
      useFactory: (ds: DataSource) => new VehicleRepository(ds),
      inject: [DataSource],
    },
    {
      provide: VehicleTypeRepository,
      useFactory: (ds: DataSource) => new VehicleTypeRepository(ds),
      inject: [DataSource],
    },
    {
      provide: DriverProfileRepository,
      useFactory: (ds: DataSource) => new DriverProfileRepository(ds),
      inject: [DataSource],
    },
    {
      provide: UserRepository,
      useFactory: (ds: DataSource) => new UserRepository(ds),
      inject: [DataSource],
    },
  ],
  exports: [
    VehicleTypeRepository,
    VehiclesService,
    VehicleRepository,
    DriverProfileRepository,
    UserRepository,
  ],
})
export class VehiclesModule {}
