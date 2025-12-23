import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from './entities/city.entity';
import { CityController } from './controllers/city.controller';
import { CityRepository } from './repositories/city.repository';
import { CityService } from './services/city.service';

@Module({
  imports: [TypeOrmModule.forFeature([City])],
  controllers: [CityController],
  providers: [CityRepository, CityService],
  exports: [CityRepository, CityService],
})
export class CityModule {}
