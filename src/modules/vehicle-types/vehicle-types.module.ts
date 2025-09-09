import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleTypeController } from './controllers/vehicle-types.controller';
import { VehicleTypesService } from './services/vehicle-types.service';
import { VehicleType } from './entities/vehicle-types.entity';
import { DataSource } from 'typeorm';
import { VehicleTypeRepository } from './repositories/vehicle-types.repository';
import { VehicleCategory } from '../vehicle-category/entities/vehicle-category.entity';
import { VehicleServiceClass } from '../vehicle-service-classes/entities/vehicle-service-classes.entity';
import { VehicleCategoryRepository } from '../vehicle-category/repositories/vehicle-category.repository';
import { VehicleServiceClassRepository } from '../vehicle-service-classes/repositories/vehicle-service-classes.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VehicleType,
      VehicleCategory,
      VehicleServiceClass,
      VehicleCategoryRepository,
      VehicleServiceClassRepository,
    ]),
  ],
  controllers: [VehicleTypeController],
  providers: [
    VehicleTypesService,
    {
      provide: VehicleTypeRepository,
      useFactory: (dataSource: DataSource) =>
        new VehicleTypeRepository(dataSource),
      inject: [DataSource],
    },
    {
      provide: VehicleCategoryRepository,
      useFactory: (dataSource: DataSource) =>
        new VehicleCategoryRepository(dataSource),
      inject: [DataSource],
    },
    {
      provide: VehicleServiceClassRepository,
      useFactory: (dataSource: DataSource) =>
        new VehicleServiceClassRepository(dataSource),
      inject: [DataSource],
    },
  ],
  exports: [
    VehicleTypeRepository,
    VehicleTypesService,
    VehicleCategoryRepository,
    VehicleServiceClassRepository,
  ],
})
export class VehicleTypesModule {}
