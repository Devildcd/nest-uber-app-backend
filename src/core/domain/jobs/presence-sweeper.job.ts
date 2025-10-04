import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  AvailabilityReason,
  DriverAvailability,
} from '../../../modules/drivers-availability/entities/driver-availability.entity';

@Injectable()
export class PresenceSweeperJob {
  private readonly logger = new Logger(PresenceSweeperJob.name);
  private readonly ttlSec: number;
  private readonly batchSize: number;

  constructor(
    private readonly ds: DataSource,
    private readonly config: ConfigService,
  ) {
    this.ttlSec = Number(this.config.get('DA_PRESENCE_TTL_SEC') ?? 120);
    this.batchSize = Number(this.config.get('DA_SWEEP_BATCH') ?? 1000);
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async sweepPresence() {
    if (this.ttlSec <= 0) return;

    const qr = this.ds.createQueryRunner();
    await qr.connect();

    try {
      const repo = qr.manager.getRepository(DriverAvailability);

      // 1) SELECT ids de los que están vencidos (lote)
      //    OJO: 'id' mapea a la PK, que en DB es '_id' gracias a tu decorator { name: '_id' }
      const stale = await repo
        .createQueryBuilder('da')
        .select('da.id', 'id')
        .where('da.is_online = true')
        .andWhere(
          `
            da.last_presence_timestamp IS NULL OR
            da.last_presence_timestamp < NOW() - (:ttl::int * INTERVAL '1 second')
          `,
          { ttl: this.ttlSec },
        )
        .orderBy('da.last_presence_timestamp', 'ASC') // ayuda a hacer "los más viejos" primero
        .limit(this.batchSize) // <-- aquí sí se puede LIMIT porque es SELECT
        .getRawMany<{ id: string }>();

      if (!stale.length) return;

      const ids = stale.map((r) => r.id);

      // 2) UPDATE por lote usando WHERE id IN (...)
      await repo
        .createQueryBuilder()
        .update(DriverAvailability)
        .set({
          isOnline: false,
          isAvailableForTrips: false,
          availabilityReason: AvailabilityReason.OFFLINE,
        })
        .whereInIds(ids)
        .execute();

      this.logger.log(
        `Presence sweep: set offline -> ${ids.length} drivers (ttl=${this.ttlSec}s)`,
      );
    } catch (err) {
      this.logger.error('Presence sweep failed', err);
    } finally {
      await qr.release();
    }
  }
}
