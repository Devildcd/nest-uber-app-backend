// src/modules/payments/repositories/cash-collection-point.repository.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { CashCollectionPoint } from '../entities/cash_colletions_points.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { CashCollectionPointFilterDto } from '../dto/cash-collection-point-filter.dto';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { formatErrorResponse } from 'src/common/utils/api-response.utils';

@Injectable()
export class CashCollectionPointRepository extends Repository<CashCollectionPoint> {
  private readonly logger = new Logger(CashCollectionPointRepository.name);
  private readonly entityName = 'CashCollectionPoint';

  constructor(dataSource: DataSource) {
    super(CashCollectionPoint, dataSource.createEntityManager());
  }

  async createAndSave(
    pointData: DeepPartial<CashCollectionPoint>,
    manager?: EntityManager,
  ): Promise<CashCollectionPoint> {
    const repo = manager ? manager.getRepository(CashCollectionPoint) : this;

    const point = repo.create(pointData);
    try {
      return await repo.save(point);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  async findById(id: string): Promise<CashCollectionPoint | null> {
    try {
      return this.findOne({
        where: { id },
      });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }

  async findByName(name: string): Promise<CashCollectionPoint | null> {
    try {
      return this.findOne({
        where: { name },
      });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findByName', this.entityName);
    }
  }

  async findByLocation(
    coordinates: [number, number],
    radiusInKm: number = 5,
  ): Promise<CashCollectionPoint[]> {
    try {
      const [longitude, latitude] = coordinates;

      return this.createQueryBuilder('point')
        .where(
          `ST_DWithin(
            point.location::geography,
            ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
            :radius * 1000
          )`,
          { longitude, latitude, radius: radiusInKm },
        )
        .andWhere('point.isActive = :isActive', { isActive: true })
        .getMany();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findByLocation',
        this.entityName,
      );
    }
  }

  async findAllPaginated(
    pagination: PaginationDto,
    filters?: CashCollectionPointFilterDto,
  ): Promise<[CashCollectionPoint[], number]> {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      const qb: SelectQueryBuilder<CashCollectionPoint> =
        this.createQueryBuilder('cashCollectionPoint')
          .skip(skip)
          .take(limit)
          .orderBy('cashCollectionPoint.createdAt', 'DESC');

      if (filters) {
        this.applyFilters(qb, filters);
      }

      return qb.getManyAndCount();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findAllPaginated',
        this.entityName,
      );
    }
  }

  private applyFilters(
    qb: SelectQueryBuilder<CashCollectionPoint>,
    filters: CashCollectionPointFilterDto,
  ): void {
    if (filters.name) {
      qb.andWhere('cashCollectionPoint.name ILIKE :name', {
        name: `%${filters.name}%`,
      });
    }

    if (filters.address) {
      qb.andWhere('cashCollectionPoint.address ILIKE :address', {
        address: `%${filters.address}%`,
      });
    }

    if (filters.contactPhone) {
      qb.andWhere('cashCollectionPoint.contact_phone ILIKE :contactPhone', {
        contactPhone: `%${filters.contactPhone}%`,
      });
    }

    if (filters.isActive !== undefined) {
      qb.andWhere('cashCollectionPoint.is_active = :isActive', {
        isActive: filters.isActive,
      });
    }

    // Filtro por proximidad geográfica
    if (filters.nearbyCoordinates && filters.radius) {
      const [longitude, latitude] = filters.nearbyCoordinates;
      qb.andWhere(
        `ST_DWithin(
          cashCollectionPoint.location::geography,
          ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
          :radius * 1000
        )`,
        { longitude, latitude, radius: filters.radius },
      );
    }
  }

  async softDeletePoint(id: string): Promise<void> {
    try {
      await this.softDelete(id);
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'softDeletePoint',
        this.entityName,
      );
    }
  }
  async mustBeActive(collectionPointId: string): Promise<CashCollectionPoint> {
    const point = await this.findOne({ where: { id: collectionPointId } });
    if (!point || !point.isActive) {
      throw new BadRequestException(
        formatErrorResponse(
          'COLLECTION_POINT_INACTIVE',
          'El punto de recaudo no está activo o no existe.',
          { collectionPointId },
        ),
      );
    }
    return point;
  }
}
