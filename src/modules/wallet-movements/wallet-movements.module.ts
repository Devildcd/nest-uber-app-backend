import { Module } from '@nestjs/common';
import { WalletMovementsController } from './controllers/wallet-movements.controller';
import { WalletMovementsService } from './services/wallet-movements.service';
import { WalletMovement } from './entities/wallet-movement.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletMovementsRepository } from './repositories/wallet-movements.repository';

@Module({
  imports: [TypeOrmModule.forFeature([WalletMovement])],
  controllers: [WalletMovementsController],
  providers: [WalletMovementsRepository, WalletMovementsService],
})
export class WalletMovementsModule {}
