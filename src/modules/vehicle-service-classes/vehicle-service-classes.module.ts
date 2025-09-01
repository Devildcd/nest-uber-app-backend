import { Module } from '@nestjs/common';
import { VehicleServiceClassesController } from './controllers/vehicle-service-classes.controller';
import { VehicleServiceClassesService } from './services/vehicle-service-classes.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleServiceClass } from './entities/vehicle-service-classes.entity';
import { VehicleServiceClassRepository } from './repositories/vehicle-service-classes.repository';
import { DataSource } from 'typeorm';
@Module({
  imports: [TypeOrmModule.forFeature([VehicleServiceClass])],
  controllers: [VehicleServiceClassesController],
  providers: [
    VehicleServiceClassesService,
    {
      provide: VehicleServiceClassRepository,
      useFactory: (dataSource: DataSource) => {
        return new VehicleServiceClassRepository(dataSource);
      },
      inject: [DataSource],
    },
  ],
  exports: [VehicleServiceClassRepository],
})
export class VehicleServiceClassesModule {}
