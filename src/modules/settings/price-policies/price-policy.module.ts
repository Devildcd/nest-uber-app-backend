/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { PricePolicy } from './entities/price-policy.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CityModule } from '../cities/city.module';
import { ZoneModule } from '../zones/zone.module';
import { PricePolicyController } from './controllers/price-policy.controller';
import { PricePolicyRepository } from './repositories/price-policy.repository';
import { PricePolicyService } from './services/price-policy.service';

@Module({
  imports: [TypeOrmModule.forFeature([PricePolicy]), CityModule, ZoneModule],
  controllers: [PricePolicyController],
  providers: [PricePolicyRepository, PricePolicyService],
  exports: [PricePolicyRepository, PricePolicyService],
})
export class PricePolicyModule {}
