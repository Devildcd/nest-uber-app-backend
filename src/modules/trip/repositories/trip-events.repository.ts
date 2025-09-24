// src/modules/trip/repositories/trip-events.repository.ts
import { DataSource, EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { TripEvent } from '../entities/trip-event.entity';
import { TripEventType } from 'src/modules/trip/interfaces/trip-event-types.enum';

@Injectable()
export class TripEventsRepository extends BaseRepository<TripEvent> {
  constructor(ds: DataSource) {
    super(
      TripEvent,
      ds.createEntityManager(),
      'TripEventsRepository',
      'TripEvent',
    );
  }

  async append(
    tripId: string,
    eventType: TripEventType,
    at: Date,
    metadata?: any,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    try {
      const entity = repo.create({
        trip: { id: tripId } as any, // si tu entidad usa relación, NO 'tripId'
        eventType, // <— nombre correcto
        occurredAt: at,
        metadata: metadata ?? null, // <— nombre correcto si tu columna es 'metadata'
      } as any);
      await repo.save(entity);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'append', this.entityName);
    }
  }

  async listByTrip(tripId: string): Promise<TripEvent[]> {
    try {
      return await this.find({
        where: { tripId } as any,
        order: { occurredAt: 'ASC' } as any,
      });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'listByTrip', this.entityName);
    }
  }
}
