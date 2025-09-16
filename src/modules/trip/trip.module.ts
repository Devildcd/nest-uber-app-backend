import { Module } from '@nestjs/common';
import { Trip } from './entities/trip.entity';
import { User } from '../user/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { TripRepository } from './repositories/trip.repository';
import { TripService } from './services/trip.service';
import { TripController } from './controllers/trip.controller';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, User, Order])],
  controllers: [TripController],
  providers: [TripService, TripRepository],
})
export class TripModule {}
