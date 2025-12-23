import { Module } from '@nestjs/common';
import { Zone } from './entities/zone.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CityModule } from '../cities/city.module';
import { ZoneService } from './services/zone.service';
import { ZoneController } from './controllers/zone.controller';
import { ZoneRepository } from './repositories/zone.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Zone]), CityModule],
  controllers: [ZoneController],
  providers: [ZoneService, ZoneRepository],
  exports: [ZoneRepository, ZoneService],
})
export class ZoneModule {}
