import { Module } from '@nestjs/common';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { IdempotencyKeyRepository } from './repositories/idempotency-key.repository';

@Module({
  imports: [IdempotencyKey],
  providers: [IdempotencyKeyRepository],
  exports: [IdempotencyKeyRepository],
})
export class CoreSettingsModule {}
