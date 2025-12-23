import { Module } from '@nestjs/common';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyKeyRepository } from './repositories/idempotency-key.repository';

@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyKey])],
  providers: [IdempotencyKeyRepository],
  exports: [IdempotencyKeyRepository],
})
export class CoreSettingsModule {}
