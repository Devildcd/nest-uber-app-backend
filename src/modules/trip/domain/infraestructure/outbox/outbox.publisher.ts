import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxEvent } from './outbox-event.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class OutboxPublisher implements OnModuleInit {
  private readonly logger = new Logger(OutboxPublisher.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly ds: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit() {
    // poll muy simple cada 2s (ajustable). Sustituible por BullMQ en el futuro.
    this.timer = setInterval(() => this.tick().catch(() => {}), 2000);
  }

  async tick() {
    // coge pocos para no bloquear
    const repo = this.ds.getRepository(OutboxEvent);
    const batch = await repo.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
      take: 20,
    });

    for (const evt of batch) {
      try {
        // por ahora, “publicamos” re-emitiendo dentro del proceso
        await this.events.emitAsync(evt.type, evt.payload);
        evt.status = 'sent';
        evt.sentAt = new Date();
        evt.failReason = null!;
        await repo.save(evt);
      } catch (err: any) {
        evt.status = 'failed';
        evt.failReason = err?.message ?? String(err);
        await repo.save(evt);
        this.logger.warn(
          `Failed to publish outbox ${evt.id}: ${evt.failReason}`,
        );
      }
    }
  }
}
