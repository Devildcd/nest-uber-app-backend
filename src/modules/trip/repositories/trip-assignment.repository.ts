import { DataSource, EntityManager, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import {
  TripAssignment,
  AssignmentStatus,
} from '../entities/trip-assignment.entity';

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

  async createOffered(
    tripId: string,
    driverId: string,
    vehicleId: string,
    ttlExpiresAt: Date,
    manager: EntityManager,
  ): Promise<TripAssignment[]> {
    const repo = this.scoped(manager);
    try {
      const entity = repo.create({
        tripId,
        driverId,
        vehicleId,
        status: AssignmentStatus.OFFERED,
        ttlExpiresAt,
      } as any);
      return await repo.save(entity);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createOffered', this.entityName);
    }
  }

  async findActiveOffer(
    tripId: string,
    driverId: string,
  ): Promise<TripAssignment | null> {
    try {
      return await this.findOne({
        where: {
          tripId,
          driverId,
          status: AssignmentStatus.OFFERED,
        } as any,
      });
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findActiveOffer',
        this.entityName,
      );
    }
  }

  async listOfferedByTrip(tripId: string): Promise<TripAssignment[]> {
    try {
      return await this.find({
        where: { tripId, status: AssignmentStatus.OFFERED } as any,
        order: { createdAt: 'ASC' } as any,
      });
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'listOfferedByTrip',
        this.entityName,
      );
    }
  }

  /** Aceptar con locks (la fijación en Trip la haces en TripRepository.assignDriver) */
  async acceptOfferWithLocks(
    assignmentId: string,
    now: Date,
    manager: EntityManager,
  ): Promise<{ tripId: string; driverId: string; vehicleId: string }> {
    const repo = this.scoped(manager);

    try {
      // Lock sobre assignment
      const a = await repo
        .createQueryBuilder('a')
        .setLock('pessimistic_write')
        .where('a.id = :id', { id: assignmentId })
        .getOne();

      if (!a) throw new Error('ASSIGNMENT_NOT_FOUND');
      if (a.status !== AssignmentStatus.OFFERED)
        throw new Error('ASSIGNMENT_NOT_OFFERED');
      if (a.ttlExpiresAt && a.ttlExpiresAt.getTime() <= now.getTime())
        throw new Error('ASSIGNMENT_EXPIRED');

      // Marcar accepted
      await repo
        .createQueryBuilder()
        .update()
        .set({ status: AssignmentStatus.ACCEPTED, respondedAt: now } as any)
        .where('id = :id', { id: assignmentId })
        .execute();

      return {
        tripId: a.tripId,
        driverId: a.driverId,
        vehicleId: a.vehicleId,
      };
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'acceptOfferWithLocks',
        this.entityName,
      );
    }
  }

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
        .execute();
    } catch (err) {
      handleRepositoryError(this.logger, err, 'rejectOffer', this.entityName);
    }
  }

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
        .execute();
    } catch (err) {
      handleRepositoryError(this.logger, err, 'expireOffer', this.entityName);
    }
  }

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
        .set({ status: AssignmentStatus.CANCELLED } as any)
        .where('trip_id = :tripId', { tripId })
        .andWhere('id != :exceptId', { exceptId: exceptAssignmentId })
        .andWhere('status = :st', { st: AssignmentStatus.OFFERED })
        .execute();

      return res.affected ?? 0;
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'cancelOtherOffers',
        this.entityName,
      );
    }
  }
}
