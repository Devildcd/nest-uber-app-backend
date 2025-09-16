import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  FindOneOptions,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Order, OrderStatus, PaymentType } from '../entities/order.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { OrderFiltersDto } from '../dto/order-filters.dto';
import { handleRepositoryError } from '../../../common/utils/handle-repository-error';
import { CreateOrderDto } from '../dto/create-order.dto';
import { _roundTo2 } from 'src/common/validators/decimal.transformer';
import { formatErrorResponse } from 'src/common/utils/api-response.utils';

@Injectable()
export class OrderRepository extends Repository<Order> {
  private readonly logger = new Logger(OrderRepository.name);
  private readonly entityName = 'Order';

  constructor(dataSource: DataSource) {
    super(Order, dataSource.createEntityManager());
  }

  async findById(id: string): Promise<Order | null> {
    try {
      return this.findOne({
        where: { id },
        relations: ['trip', 'passenger'],
      });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findById', this.entityName);
    }
  }

  async findByTripId(
    tripId: string,
    manager: EntityManager,
  ): Promise<Order | null> {
    try {
      return manager.findOne(Order, {
        where: { trip: { id: tripId } },
        relations: ['trip', 'passenger', 'driver'],
      });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findByTripId', this.entityName);
    }
  }

  /**
   * Crea Order pendiente para un trip (pago en efectivo).
   * Idempotente por uq_orders_trip:
   *  - Si existe y coincide en requestedAmount/paymentType -> retorna existente (created=false).
   *  - Si existe pero difiere -> 409.
   */
  async createPendingForTrip(
    manager: EntityManager,
    params: {
      tripId: string;
      passengerId: string;
      driverId: string;
      requestedAmount: number; // positivo
      paymentType: PaymentType; // CASH
    },
  ): Promise<{ order: Order; created: boolean }> {
    const repo = manager.getRepository(Order);

    // Intento de lectura previa (idempotencia amable)
    const existing = await repo.findOne({
      where: { trip: { id: params.tripId } as any },
    });

    if (existing) {
      const samePayment = existing.paymentType === params.paymentType;
      const sameAmount =
        Math.abs(
          _roundTo2(Number(existing.requestedAmount)) -
            _roundTo2(params.requestedAmount),
        ) < 0.005;

      if (!samePayment || !sameAmount) {
        throw new ConflictException(
          formatErrorResponse(
            'ORDER_ALREADY_EXISTS_MISMATCH',
            'Ya existe una orden para este viaje con valores distintos.',
            {
              tripId: params.tripId,
              existing: {
                id: existing.id,
                paymentType: existing.paymentType,
                requestedAmount: existing.requestedAmount,
              },
              requested: {
                paymentType: params.paymentType,
                requestedAmount: params.requestedAmount,
              },
            },
          ),
        );
      }
      return { order: existing, created: false };
    }

    const entity = repo.create({
      trip: { id: params.tripId } as any,
      passenger: { id: params.passengerId } as any,
      driver: { id: params.driverId } as any,
      requestedAmount: _roundTo2(params.requestedAmount),
      paymentType: params.paymentType,
      status: OrderStatus.PENDING,
    });

    try {
      const saved = await repo.save(entity);
      return { order: saved, created: true };
    } catch (err: any) {
      if (err?.code === '23505') {
        // uq_orders_trip
        // Releer y aplicar la misma lógica de coherencia
        const again = await repo.findOne({
          where: { trip: { id: params.tripId } as any },
        });
        if (again) {
          const samePayment = again.paymentType === params.paymentType;
          const sameAmount =
            Math.abs(
              _roundTo2(Number(again.requestedAmount)) -
                _roundTo2(params.requestedAmount),
            ) < 0.005;
          if (samePayment && sameAmount)
            return { order: again, created: false };
        }
      }
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  async markPaid(
    manager: EntityManager,
    order: Order,
    confirmedByUserId: string,
  ): Promise<Order> {
    if (!order) {
      throw new NotFoundException(
        formatErrorResponse('ORDER_NOT_FOUND', 'Orden no encontrada.'),
      );
    }

    // Si ya está PAID, devolvemos idempotente sin alterar campos
    if (order.status === OrderStatus.PAID) {
      return order;
    }
    if (
      order.status === OrderStatus.FAILED ||
      order.status === OrderStatus.REFUNDED
    ) {
      throw new BadRequestException(
        formatErrorResponse(
          'ORDER_IN_INVALID_STATE',
          `No se puede pagar una orden en estado ${order.status}.`,
          { orderId: order.id, status: order.status },
        ),
      );
    }

    order.status = OrderStatus.PAID;
    order.paidAt = new Date();
    order.confirmedBy = confirmedByUserId;

    return await manager.getRepository(Order).save(order);
  }

  async loadAndLockOrder(
    manager: EntityManager,
    orderId: string,
  ): Promise<Order> {
    const qb = manager
      .getRepository(Order)
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.trip', 'trip')
      .leftJoinAndSelect('o.driver', 'driver')
      .leftJoinAndSelect('o.passenger', 'passenger')
      .setLock('pessimistic_write')
      .where('o.id = :orderId', { orderId });

    const order = await qb.getOne();
    if (!order) {
      throw new NotFoundException(
        formatErrorResponse('ORDER_NOT_FOUND', 'Orden no encontrada.', {
          orderId,
        }),
      );
    }
    return order;
  }

  async findAllPaginated(
    pagination: PaginationDto,
    filters?: OrderFiltersDto,
  ): Promise<[Order[], number]> {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      const qb: SelectQueryBuilder<Order> = this.createQueryBuilder('ord')
        .leftJoinAndSelect('ord.passenger', 'passenger')
        .leftJoinAndSelect('ord.trip', 'trip')
        .skip(skip)
        .take(limit)
        .orderBy('ord.createdAt', 'DESC');

      if (filters) {
        this.applyFilters(qb, filters);
      }

      return await qb.getManyAndCount();
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
    qb: SelectQueryBuilder<Order>,
    filters: OrderFiltersDto,
  ): void {
    if (!filters) return;

    if (filters.status) {
      qb.andWhere('ord.status = :status', { status: filters.status });
    }

    if (filters.passengerId) {
      qb.andWhere('passenger.id = :passengerId', {
        passengerId: filters.passengerId,
      });
    }

    if (filters.minAmount !== undefined && filters.minAmount !== null) {
      qb.andWhere('ord.requestedAmount >= :minAmount', {
        minAmount: filters.minAmount,
      });
    }

    if (filters.maxAmount !== undefined && filters.maxAmount !== null) {
      qb.andWhere('ord.requestedAmount <= :maxAmount', {
        maxAmount: filters.maxAmount,
      });
    }

    if (filters.startDate) {
      qb.andWhere('ord.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters.endDate) {
      qb.andWhere('ord.createdAt <= :endDate', { endDate: filters.endDate });
    }

    if (filters.search) {
      const q = `%${filters.search}%`;
      qb.andWhere(
        `(ord.id ILIKE :q OR passenger.name ILIKE :q OR passenger.email ILIKE :q)`,
        { q },
      );
    }
  }

  async softDeleteOrder(id: string): Promise<void> {
    try {
      const result = await this.softDelete(id);
      // opcional: validar affected
      if (result && (result as any).affected === 0) {
        // no row affected — dejar que el service maneje NotFound si lo desea
        this.logger.warn(`softDeleteOrder: no rows affected for id=${id}`);
      }
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'softDeleteOrder',
        this.entityName,
      );
    }
  }

  async findWithRelations(
    id: string,
    relations: string[] = [],
    options?: Omit<FindOneOptions<Order>, 'relations' | 'where'>,
    manager?: EntityManager,
  ): Promise<Order | null> {
    const repo = manager ? manager.getRepository(Order) : this;
    try {
      return await repo.findOne({
        where: { id } as any,
        relations,
        ...options,
      });
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findWithRelations',
        this.entityName,
      );
    }
  }
}
