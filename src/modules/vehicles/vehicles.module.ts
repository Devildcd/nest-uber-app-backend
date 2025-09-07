import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { VehicleType } from '../vehicle-types/entities/vehicle-types.entity';
import { DriverProfile } from '../driver-profiles/entities/driver-profile.entity';
import { VehicleRepository } from './repositories/vehicle.repository';
import { VehicleTypeRepository } from '../vehicle-types/repositories/vehicle-types.repository';
import { DriverProfileRepository } from '../driver-profiles/repositories/driver-profile.repository';
import { VehicleController } from './controllers/vehicle.controller';
import { VehiclesService } from './services/vehicles.service';
import { UserService } from "../user/services/user.service";
import { User } from "../user/entities/user.entity";
import { UserRepository } from "../user/repositories/user.repository";
import { DataSource } from 'typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle,VehicleType,DriverProfile,User,VehicleRepository,VehicleTypeRepository,DriverProfileRepository,UserRepository ])],
  controllers: [VehicleController],
  providers: [
    VehiclesService,
      {
      provide: VehicleRepository,
      useFactory: (dataSource: DataSource) => new VehicleRepository(dataSource),
      inject: [DataSource],
    },
    {
      provide: VehicleTypeRepository,
      useFactory: (dataSource: DataSource) => new VehicleTypeRepository(dataSource),
      inject: [DataSource],
    },
    {
      provide: DriverProfileRepository,
      useFactory: (dataSource: DataSource) => new DriverProfileRepository(dataSource),
      inject: [DataSource],
    },
    {
      provide: UserRepository,
      useFactory: (dataSource: DataSource) => new UserRepository(dataSource),
      inject: [DataSource],
    },
    ],
    exports: [VehicleTypeRepository, VehiclesService, VehicleRepository, DriverProfileRepository,UserRepository],
})
export class VehiclesModule {}
