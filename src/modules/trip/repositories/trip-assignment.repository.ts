import { DataSource, EntityManager, IsNull } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import {
  TripAssignment,
  AssignmentStatus,
} from '../entities/trip-assignment.entity';
import { Trip, TripStatus } from '../entities/trip.entity';
import { User } from 'src/modules/user/entities/user.entity';
import { Vehicle } from 'src/modules/vehicles/entities/vehicle.entity';

@Injectable()
export class TripAssignmentRepository extends BaseRepository<TripAssignment> {
  constructor(ds: DataSource) {
    super(
      TripAssignment,
      ds.createEntityManager(),
      'TripAssignmentRepository',
      'TripAssignment',
    );
  }

  /** Crea una oferta (status=OFFERED) con relaciones, no con *_id planos */
  async createOffered(
    tripId: string,
    driverId: string,
    vehicleId: string,
    ttlExpiresAt: Date,
    manager: EntityManager,
    metadata?: Record<string, any>,
  ): Promise<TripAssignment> {
    const repo = this.scoped(manager);
    try {
      const entity = repo.create({
        trip: { id: tripId } as Trip,
        driver: { id: driverId } as User,
        vehicle: { id: vehicleId } as Vehicle,
        status: AssignmentStatus.OFFERED,
        ttlExpiresAt,
        respondedAt: null,
        ...(metadata ? { metadata } : {}),
      } as Partial<TripAssignment>);

      return await repo.save(entity);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createOffered', this.entityName);
      throw err;
    }
  }

  /** Cambia el status (y opcionalmente una marca temporal) */
  async setStatusAssigning(
    id: string,
    now: Date,
    manager: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    try {
      // Si tienes la columna assigning_started_at en trips, inclúyela en el SET:
      // .set({ currentStatus: TripStatus.ASSIGNING, assigningStartedAt: now } as any)
      await repo
        .createQueryBuilder()
        .update()
        .set({ currentStatus: TripStatus.ASSIGNING } as any)
        .where('id = :id', { id })
        .execute();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'setStatusAssigning',
        this.entityName,
      );
      throw err;
    }
  }

  /** Oferta ACTIVA: status=offered y responded_at IS NULL */
  async findActiveOffer(
    tripId: string,
    driverId: string,
    manager?: EntityManager,
  ): Promise<TripAssignment | null> {
    const repo = this.scoped(manager);
    try {
      return await repo.findOne({
        where: {
          trip: { id: tripId } as any,
          driver: { id: driverId } as any,
          status: AssignmentStatus.OFFERED,
          respondedAt: IsNull(),
        },
        relations: {
          trip: false,
          driver: false,
          vehicle: false,
        },
      });
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findActiveOffer',
        this.entityName,
      );
      throw err;
    }
  }

  /** Lista ofertas ACTIVAS de un viaje */
  async listOfferedByTrip(
    tripId: string,
    manager?: EntityManager,
  ): Promise<TripAssignment[]> {
    const repo = this.scoped(manager);
    try {
      return await repo.find({
        where: {
          trip: { id: tripId } as any,
          status: AssignmentStatus.OFFERED,
          respondedAt: IsNull(),
        },
        order: { offeredAt: 'ASC' },
      });
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'listOfferedByTrip',
        this.entityName,
      );
      throw err;
    }
  }

  /**
   * Aceptar oferta con lock:
   * Devuelve tripId/driverId/vehicleId leyendo desde las RELACIONES.
   */
  async acceptOfferWithLocks(
    assignmentId: string,
    now: Date,
    manager: EntityManager,
  ): Promise<{ tripId: string; driverId: string; vehicleId: string }> {
    const repo = this.scoped(manager);

    // Lock + cargar relaciones para recuperar IDs
    const a = await repo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.trip', 't')
      .leftJoinAndSelect('a.driver', 'd')
      .leftJoinAndSelect('a.vehicle', 'v')
      .setLock('pessimistic_write')
      .where('a.id = :id', { id: assignmentId })
      .getOne();

    if (!a) throw new Error('ASSIGNMENT_NOT_FOUND');
    if (a.status !== AssignmentStatus.OFFERED)
      throw new Error('ASSIGNMENT_NOT_OFFERED');
    if (a.respondedAt) throw new Error('ASSIGNMENT_ALREADY_RESPONDED');
    if (a.ttlExpiresAt && a.ttlExpiresAt.getTime() <= now.getTime())
      throw new Error('ASSIGNMENT_EXPIRED');

    await repo
      .createQueryBuilder()
      .update()
      .set({ status: AssignmentStatus.ACCEPTED, respondedAt: now })
      .where('id = :id', { id: assignmentId })
      .andWhere('status = :st', { st: AssignmentStatus.OFFERED })
      .andWhere('responded_at IS NULL')
      .execute();

    return {
      tripId: (a.trip as any).id,
      driverId: (a.driver as any).id,
      vehicleId: (a.vehicle as any).id,
    };
  }

  async ensureNoActiveOfferForTrip(
    tripId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    try {
      const exists = await repo
        .createQueryBuilder('a')
        .select('1')
        .where('a.trip_id = :tripId', { tripId })
        .andWhere('a.status = :st', { st: AssignmentStatus.OFFERED })
        .andWhere('a.responded_at IS NULL')
        .limit(1)
        .getRawOne();

      if (exists) {
        // puedes lanzar un error específico de dominio
        throw new Error('ACTIVE_OFFER_ALREADY_EXISTS_FOR_TRIP');
      }
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'ensureNoActiveOfferForTrip',
        this.entityName,
      );
      throw err;
    }
  }

  /** Lee una oferta ACTIVA por id (offered + responded_at IS NULL) con relaciones. */
  async getOfferedById(
    assignmentId: string,
    manager?: EntityManager,
  ): Promise<TripAssignment | null> {
    const repo = this.scoped(manager);
    try {
      return await repo.findOne({
        where: {
          id: assignmentId as any,
          status: AssignmentStatus.OFFERED,
          respondedAt: IsNull(),
        } as any,
        relations: { trip: true, driver: true, vehicle: true },
      });
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'getOfferedById',
        this.entityName,
      );
      throw err;
    }
  }

  /** Rechazar (sólo si sigue offered y sin respuesta) */
  async rejectOffer(
    assignmentId: string,
    now: Date,
    manager: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    try {
      await repo
        .createQueryBuilder()
        .update()
        .set({ status: AssignmentStatus.REJECTED, respondedAt: now } as any)
        .where('id = :id', { id: assignmentId })
        .andWhere('status = :st', { st: AssignmentStatus.OFFERED })
        .andWhere('responded_at IS NULL')
        .execute();
    } catch (err) {
      handleRepositoryError(this.logger, err, 'rejectOffer', this.entityName);
      throw err;
    }
  }

  // 1.2) (Opcional) Cancelar TODAS las ofertas activas de un trip
  async cancelAllActiveOffers(
    tripId: string,
    manager: EntityManager,
  ): Promise<number> {
    const repo = this.scoped(manager);
    try {
      const res = await repo
        .createQueryBuilder()
        .update()
        .set({ status: AssignmentStatus.CANCELLED, respondedAt: () => 'now()' })
        .where('trip_id = :tripId', { tripId })
        .andWhere('status = :st', { st: AssignmentStatus.OFFERED })
        .andWhere('responded_at IS NULL')
        .execute();
      return res.affected ?? 0;
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'cancelAllActiveOffers',
        this.entityName,
      );
      throw err;
    }
  }

  /** Expirar (sólo si sigue offered y sin respuesta) */
  async expireOffer(
    assignmentId: string,
    now: Date,
    manager: EntityManager,
  ): Promise<void> {
    const repo = this.scoped(manager);
    try {
      await repo
        .createQueryBuilder()
        .update()
        .set({ status: AssignmentStatus.EXPIRED, respondedAt: now } as any)
        .where('id = :id', { id: assignmentId })
        .andWhere('status = :st', { st: AssignmentStatus.OFFERED })
        .andWhere('responded_at IS NULL')
        .execute();
    } catch (err) {
      handleRepositoryError(this.logger, err, 'expireOffer', this.entityName);
      throw err;
    }
  }

  /**
   * Cancela todas las demás ofertas ACTIVAS del viaje.
   * Aquí es correcto usar la columna `trip_id` en SQL (existe en la tabla),
   * aunque el entity no tenga la propiedad plana.
   */
  async cancelOtherOffers(
    tripId: string,
    exceptAssignmentId: string,
    manager: EntityManager,
  ): Promise<number> {
    const repo = this.scoped(manager);
    try {
      const res = await repo
        .createQueryBuilder()
        .update()
        .set({ status: AssignmentStatus.CANCELLED, respondedAt: () => 'now()' })
        .where('trip_id = :tripId', { tripId })
        .andWhere('id != :exceptId', { exceptId: exceptAssignmentId })
        .andWhere('status = :st', { st: AssignmentStatus.OFFERED })
        .andWhere('responded_at IS NULL')
        .execute();

      return res.affected ?? 0;
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'cancelOtherOffers',
        this.entityName,
      );
      throw err;
    }
  }

  /** Batch de expiración (job/cron). Puedes mantener esta versión o usar un SELECT previo. */
  async expireExpiredOffersBatch(
    now: Date,
    limit = 200,
    manager?: EntityManager,
  ): Promise<number> {
    const repo = this.scoped(manager);
    try {
      // estrategia 1: select ids primero (porque PG ignora LIMIT en UPDATE)
      const ids = await repo
        .createQueryBuilder('a')
        .select('a.id', 'id')
        .where('a.status = :st', { st: AssignmentStatus.OFFERED })
        .andWhere('a.responded_at IS NULL')
        .andWhere('a.ttl_expires_at IS NOT NULL')
        .andWhere('a.ttl_expires_at <= :now', { now })
        .orderBy('a.ttl_expires_at', 'ASC')
        .limit(limit)
        .getRawMany<{ id: string }>();

      if (!ids.length) return 0;

      const res = await repo
        .createQueryBuilder()
        .update()
        .set({ status: AssignmentStatus.EXPIRED, respondedAt: now })
        .whereInIds(ids.map((r) => r.id))
        .execute();

      return res.affected ?? 0;
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'expireExpiredOffersBatch',
        this.entityName,
      );
      throw err;
    }
  }
}
