import { Module } from '@nestjs/common';
import { VehicleCategoryController } from './controllers/vehicle-category.controller';
import { VehicleCategoryService } from './services/vehicle-category.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleCategory } from './entities/vehicle-category.entity';
import { DataSource } from 'typeorm';
import { VehicleCategoryRepository } from './repositories/vehicle-category.repository';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleCategory])],
  controllers: [VehicleCategoryController],
  providers: [
    VehicleCategoryService,
    {
      provide: VehicleCategoryRepository,
      useFactory: (dataSource: DataSource) => {
        return new VehicleCategoryRepository(dataSource);
      },
      inject: [DataSource],
    },
  ],
  exports: [VehicleCategoryRepository],
})
export class VehicleCategoryModule {}
