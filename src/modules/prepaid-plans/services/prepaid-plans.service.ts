// prepaid-plans/prepaid-plans.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { PrepaidPlanRepository } from '../repositories/prepaid-plans.repository';
import { CreatePrepaidPlanDto } from '../dto/create-prepaid-plan.dto';
import { UpdatePrepaidPlanDto } from '../dto/update-prepaid-plan.dto';
import { QueryPrepaidPlanDto } from '../dto/query-prepaid-plan.dto';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { paginated } from 'src/common/utils/response-helpers';
import { withQueryRunnerTx } from 'src/common/utils/tx.util';
import { PrepaidPlan } from '../entities/prepaid-plans.entity';
import { PrepaidPlanResponseDto } from '../dto/prepaid-plan-response.dto';
import { TransactionRepository } from 'src/modules/transactions/repositories/transactions.repository';
import { UserPrepaidPlanRepository } from '../repositories/user-prepaid-plans.repository';
import { CashCollectionRecordRepository } from 'src/modules/cash_colletions_points/repositories/cash_colletion_records.repository';
import { PurchasePrepaidPlanCashDto } from '../dto/purchase-prepaid-plan-cash.dto';
import { PurchasePrepaidPlanResponseDto } from '../dto/purchase-prepaid-plan-response.dto';
import { User } from 'src/modules/user/entities/user.entity';
import { CashCollectionPoint } from 'src/modules/cash_colletions_points/entities/cash_colletions_points.entity';
import {
  TransactionStatus,
  TransactionType,
} from 'src/modules/transactions/entities/transaction.entity';
import { CashCollectionStatus } from 'src/modules/cash_colletions_points/entities/cash_colletion_records.entity';
import {
  UserPrepaidPlan,
  UserPrepaidPlanStatus,
} from '../entities/user-prepaid-plans.entity';
import { DriverBalanceRepository } from 'src/modules/driver_balance/repositories/driver_balance.repository';
import { WalletMovementsRepository } from 'src/modules/driver_balance/repositories/wallet-movements.repository';
import { WalletMovement } from 'src/modules/driver_balance/entities/wallet-movement.entity';
import { PurchasePrepaidPlanWalletDto } from '../dto/purchase-prepaid-plan-wallet.dto';
import { _roundTo2 } from 'src/common/validators/decimal.transformer';
import { UserActivePrepaidPlanResponseDto } from '../dto/user-active-prepaid-plan-response.dto';

type ConsumeOneResult = {
  userPrepaidPlanId: string;
  userId: string;
  planId: string;
  tripsRemaining: number | null;
  status: UserPrepaidPlanStatus;
  lastUsedAt: string | null;
};

@Injectable()
export class PrepaidPlansService {
  private readonly logger = new Logger(PrepaidPlansService.name);

  constructor(
    private readonly prepaidRepo: PrepaidPlanRepository,
    private readonly dataSource: DataSource,
    private readonly txRepo: TransactionRepository,
    private readonly userPlanRepo: UserPrepaidPlanRepository,
    private readonly cashRecordRepo: CashCollectionRecordRepository,
    private readonly walletRepo: DriverBalanceRepository,
    private readonly walletMovRepo: WalletMovementsRepository,
  ) {}

  /** Listado paginado (envelope estándar) */
  async findAll(
    q: QueryPrepaidPlanDto,
  ): Promise<ApiResponseDto<PrepaidPlanResponseDto[], PaginationMetaDto>> {
    const { page = 1, limit = 10 } = q;

    const [rows, total] = await this.prepaidRepo.findAllPaginated(
      { page, limit },
      q,
    );

    const items = rows.map(toPrepaidPlanResponseDto);
    return paginated(items, total, page, limit, 'Prepaid plans retrieved');
  }

  /** Detalle por id */
  async findOne(id: string): Promise<ApiResponseDto<PrepaidPlanResponseDto>> {
    const plan = await this.prepaidRepo.findById(id);
    if (!plan) throw new NotFoundException('Prepaid plan not found');

    return {
      success: true,
      message: 'Prepaid plan retrieved',
      data: toPrepaidPlanResponseDto(plan),
    };
  }

  /** Crear plan (TX corta) */
  async create(
    dto: CreatePrepaidPlanDto,
  ): Promise<ApiResponseDto<PrepaidPlanResponseDto>> {
    // Regla de negocio: evita descuentos simultáneos si así lo definiste
    if (dto.discountPct && dto.fixedDiscountAmount) {
      throw new BadRequestException(
        'discountPct and fixedDiscountAmount cannot coexist',
      );
    }

    const created = await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        const entity = await this.prepaidRepo.createAndSave(
          {
            name: dto.name,
            description: dto.description ?? null,
            tripsIncluded: dto.tripsIncluded ?? null,
            discountPct: dto.discountPct ?? null,
            fixedDiscountAmount: dto.fixedDiscountAmount ?? null,
            expiresInDays: dto.expiresInDays ?? null,
            price: dto.price,
            currency: dto.currency,
            isActive: dto.isActive ?? true,
            planFeatures: dto.planFeatures ?? null,
          },
          manager,
        );
        return entity;
      },
      { logLabel: 'prepaid_plans.create' },
    );

    return {
      success: true,
      message: 'Prepaid plan created',
      data: toPrepaidPlanResponseDto(created),
    };
  }

  /** Actualizar plan (TX corta) */
  async update(
    id: string,
    dto: UpdatePrepaidPlanDto,
  ): Promise<ApiResponseDto<PrepaidPlanResponseDto>> {
    if (dto.discountPct && dto.fixedDiscountAmount) {
      throw new BadRequestException(
        'discountPct and fixedDiscountAmount cannot coexist',
      );
    }

    const updated = await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        const existing = await this.prepaidRepo.findById(id);
        if (!existing) throw new NotFoundException('Prepaid plan not found');

        const saved = await this.prepaidRepo.updatePartial(
          id,
          {
            name: dto.name,
            description: dto.description,
            tripsIncluded: dto.tripsIncluded,
            discountPct: dto.discountPct,
            fixedDiscountAmount: dto.fixedDiscountAmount,
            expiresInDays: dto.expiresInDays,
            price: dto.price,
            currency: dto.currency,
            isActive: dto.isActive,
            planFeatures: dto.planFeatures,
          },
          manager,
        );
        return saved;
      },
      { logLabel: 'prepaid_plans.update' },
    );

    return {
      success: true,
      message: 'Prepaid plan updated',
      data: toPrepaidPlanResponseDto(updated),
    };
  }

  /** Activar/Desactivar (TX corta) */
  async toggleActive(
    id: string,
    isActive: boolean,
  ): Promise<ApiResponseDto<PrepaidPlanResponseDto>> {
    const updated = await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        const existing = await this.prepaidRepo.findById(id);
        if (!existing) throw new NotFoundException('Prepaid plan not found');
        return this.prepaidRepo.toggleActive(id, isActive, manager);
      },
      { logLabel: 'prepaid_plans.toggle_active' },
    );

    return {
      success: true,
      message: isActive ? 'Prepaid plan activated' : 'Prepaid plan deactivated',
      data: toPrepaidPlanResponseDto(updated),
    };
  }

  /** Eliminar (TX corta) */
  async remove(id: string): Promise<ApiResponseDto<null>> {
    await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        const existing = await this.prepaidRepo.findById(id);
        if (!existing) throw new NotFoundException('Prepaid plan not found');
        await this.prepaidRepo.removeById(id, manager);
      },
      { logLabel: 'prepaid_plans.remove' },
    );

    return {
      success: true,
      message: 'Prepaid plan deleted',
      data: null,
    };
  }

  /** Compra en efectivo de un plan */
  async purchaseCash(
    dto: PurchasePrepaidPlanCashDto,
    idemKey?: string, // leerlo desde header en el controller
  ): Promise<ApiResponseDto<PurchasePrepaidPlanResponseDto>> {
    const now = new Date();

    // A) Idempotencia rápida (si viene key)
    if (idemKey) {
      const prev = await this.txRepo.findPlanPurchaseByIdemKey(idemKey);
      if (prev) {
        const existing = await this.userPlanRepo.findByInitialTransactionId(
          prev.id,
        );
        if (existing) {
          const plan = await this.prepaidRepo.findById(existing.planId);
          const tripsIncluded = plan?.tripsIncluded ?? null;
          const liability =
            tripsIncluded && tripsIncluded > 0
              ? (
                  Number(plan!.price) *
                  (Number(existing.tripsRemaining ?? 0) / tripsIncluded)
                ).toFixed(2)
              : null;

          return {
            success: true,
            message: 'Prepaid plan cash purchase (idempotent replay)',
            data: {
              userPrepaidPlanId: existing.id,
              planId: existing.planId,
              buyerUserId: existing.userId,
              price: plan!.price,
              currency: plan!.currency,
              tripsRemaining: existing.tripsRemaining ?? null,
              expirationDate: existing.expirationDate?.toISOString?.() ?? null,
              transactionId: prev.id,
              liabilityEstimated: liability,
            },
          };
        }
      }
    }

    // B) Trabajo real bajo TX
    const result = await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        // Guardarraíles
        const plan = await this.prepaidRepo.findById(dto.planId);
        if (!plan) throw new NotFoundException('Plan not found');
        if (!plan.isActive) throw new BadRequestException('Plan is not active');
        if (!plan.price || Number(plan.price) <= 0) {
          throw new BadRequestException('Invalid plan price');
        }

        // Validar existencias mínimas para FKs fuertes (opcional pero recomendado)
        const buyer = await manager
          .getRepository(User)
          .findOne({ where: { id: dto.buyerUserId } });
        if (!buyer) throw new NotFoundException('Buyer user not found');

        const collectionPoint = await manager
          .getRepository(CashCollectionPoint)
          .findOne({ where: { id: dto.collectionPointId } });
        if (!collectionPoint)
          throw new NotFoundException('Collection point not found');

        const collectedBy = await manager
          .getRepository(User)
          .findOne({ where: { id: dto.collectedByUserId } });
        if (!collectedBy)
          throw new NotFoundException('Collected-by staff user not found');

        // Idempotencia dentro de TX (si llega idemKey)
        if (idemKey) {
          const already = await this.txRepo.findPlanPurchaseByIdemKey(
            idemKey,
            manager,
          );
          if (already) {
            const up = await this.userPlanRepo.findByInitialTransactionId(
              already.id,
              manager,
            );
            if (up) {
              throw new ConflictException(
                'Duplicate purchase (idempotency key already used)',
              );
            }
          }
        }

        const purchaseDate = now;
        const expirationDate =
          plan.expiresInDays != null
            ? new Date(
                purchaseDate.getTime() +
                  plan.expiresInDays * 24 * 60 * 60 * 1000,
              )
            : null;
        const tripsRemaining = plan.tripsIncluded ?? 0;

        // 1) Crear transacción contable (PROCESSED por efectivo)
        const tx = await this.txRepo.createAndSave(
          {
            type: TransactionType.PLAN_PURCHASE,
            status: TransactionStatus.PROCESSED,
            processedAt: now,
            fromUser: { id: dto.buyerUserId } as any, // quien paga
            toUser: { id: dto.collectedByUserId } as any, // quien recibe en nombre de la plataforma
            grossAmount: Number(plan.price),
            platformFeeAmount: 0,
            netAmount: Number(plan.price),
            currency: plan.currency,
            description: `Prepaid plan purchase: ${plan.name}`,
            metadata: {
              planId: plan.id,
              planPriceAtPurchase: plan.price,
              idempotencyKey: idemKey ?? null,
              buyerUserId: dto.buyerUserId,
              collectionPointId: dto.collectionPointId,
              collectedByUserId: dto.collectedByUserId,
            },
          },
          manager,
        );

        // 2) Registrar cash collection (depósito en punto de recaudo)
        await this.cashRecordRepo.createAndSave(
          {
            driver: { id: dto.buyerUserId } as any, // quién deposita (driver)
            collectionPoint: { id: dto.collectionPointId } as any,
            collectedBy: { id: dto.collectedByUserId } as any, // staff/operador
            amount: Number(plan.price),
            currency: plan.currency,
            status: CashCollectionStatus.COMPLETED,
            transaction: { id: tx.id } as any,
            notes: `Plan Purchase: ${dto.planId}`,
          },
          manager,
        );

        // 3) Alta en user_prepaid_plans
        const userPlan = await this.userPlanRepo.createAndSave(
          {
            userId: dto.buyerUserId,
            planId: plan.id,
            purchaseDate,
            expirationDate,
            tripsRemaining: tripsRemaining ?? null,
            status: UserPrepaidPlanStatus.ACTIVE,
            initialPurchaseTransactionId: tx.id,
          },
          manager,
        );

        const liability =
          plan.tripsIncluded && plan.tripsIncluded > 0
            ? (
                Number(plan.price) *
                (Number(userPlan.tripsRemaining ?? 0) / plan.tripsIncluded)
              ).toFixed(2)
            : null;

        const response: PurchasePrepaidPlanResponseDto = {
          userPrepaidPlanId: userPlan.id,
          planId: plan.id,
          buyerUserId: dto.buyerUserId,
          price: plan.price,
          currency: plan.currency,
          tripsRemaining: userPlan.tripsRemaining ?? null,
          expirationDate: expirationDate?.toISOString() ?? null,
          transactionId: tx.id,
          liabilityEstimated: liability,
        };

        return response;
      },
      { logLabel: 'prepaid_plans.purchase_cash' },
    );

    return {
      success: true,
      message: 'Prepaid plan purchased with cash',
      data: result,
    };
  }
  /**
   * Compra de plan usando la WALLET del driver (débito directo).
   * Guardarraíles:
   * - Idempotencia por Idempotency-Key (Transaction metadata.idempotencyKey)
   * - Wallet lock FOR UPDATE + verificación de status
   * - Moneda del plan debe coincidir con moneda del wallet
   * - No exceder allowed_negative_limit (si lo usas; por defecto 0)
   * - Movimiento de wallet idempotente por transactionId
   */
  async purchaseWithWallet(
    dto: PurchasePrepaidPlanWalletDto,
    idemKey?: string,
  ): Promise<ApiResponseDto<PurchasePrepaidPlanResponseDto>> {
    const now = new Date();

    // A) Idempotencia rápida por key
    if (idemKey) {
      const prev = await this.txRepo.findPlanPurchaseByIdemKey(idemKey);
      if (prev) {
        const existing = await this.userPlanRepo.findByInitialTransactionId(
          prev.id,
        );
        if (existing) {
          const plan = await this.prepaidRepo.findById(existing.planId);
          const tripsIncluded = plan?.tripsIncluded ?? null;
          const liability =
            tripsIncluded && tripsIncluded > 0
              ? (
                  Number(plan!.price) *
                  (Number(existing.tripsRemaining ?? 0) / tripsIncluded)
                ).toFixed(2)
              : null;

          return {
            success: true,
            message: 'Prepaid plan wallet purchase (idempotent replay)',
            data: {
              userPrepaidPlanId: existing.id,
              planId: existing.planId,
              buyerUserId: existing.userId,
              price: plan!.price,
              currency: plan!.currency,
              tripsRemaining: existing.tripsRemaining ?? null,
              expirationDate: existing.expirationDate?.toISOString?.() ?? null,
              transactionId: prev.id,
              liabilityEstimated: liability,
            },
          };
        }
      }
    }

    // B) Trabajo real bajo TX
    const result = await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        // 1) Plan válido
        const plan = await this.prepaidRepo.findById(dto.planId);
        if (!plan) throw new NotFoundException('Plan not found');
        if (!plan.isActive) throw new BadRequestException('Plan is not active');
        const price = Number(plan.price);
        if (!isFinite(price) || price <= 0) {
          throw new BadRequestException('Invalid plan price');
        }

        // 2) Buyer existente
        const buyer = await manager
          .getRepository(User)
          .findOne({ where: { id: dto.buyerUserId } });
        if (!buyer) throw new NotFoundException('Buyer user not found');

        // 3) Idempotencia intra-TX por key (si viene)
        if (idemKey) {
          const already = await this.txRepo.findPlanPurchaseByIdemKey(
            idemKey,
            manager,
          );
          if (already) {
            const up = await this.userPlanRepo.findByInitialTransactionId(
              already.id,
              manager,
            );
            if (up)
              throw new ConflictException(
                'Duplicate purchase (idempotency key already used)',
              );
          }
        }

        // 4) Wallet lock + checks
        const wallet = await this.walletRepo
          .lockByDriverId(manager, dto.buyerUserId)
          .catch(() => {
            throw new NotFoundException('Driver wallet not found');
          });

        if (wallet.status === 'blocked') {
          throw new ConflictException('Wallet is blocked');
        }

        const currency = (plan.currency || wallet.currency).toUpperCase();
        if (currency !== wallet.currency) {
          throw new BadRequestException(
            `Currency mismatch (wallet=${wallet.currency}, plan=${currency})`,
          );
        }

        // 5) Cálculo de nuevo saldo y límite negativo permitido
        const previous = _roundTo2(Number(wallet.currentWalletBalance));
        const debit = _roundTo2(price);
        const newBalance = _roundTo2(previous - debit);

        const allowedNegative = wallet.allowedNegativeLimit ?? 0; // si no usas límite negativo, queda 0
        if (newBalance < allowedNegative) {
          throw new BadRequestException(
            `Insufficient wallet balance (would be ${newBalance}, min allowed ${allowedNegative})`,
          );
        }

        // 6) Crear transacción PLAN_PURCHASE (PROCESSED) idempotente por idemKey
        const tx = await this.txRepo.createAndSave(
          {
            type: TransactionType.PLAN_PURCHASE,
            status: TransactionStatus.PROCESSED,
            processedAt: now,
            fromUser: { id: dto.buyerUserId } as any, // paga el driver desde su wallet
            toUser: null, // el contrapartida es la plataforma (no es necesario un user)
            grossAmount: debit,
            platformFeeAmount: 0,
            netAmount: debit,
            currency,
            description: `Prepaid plan purchase (wallet): ${plan.name}`,
            metadata: {
              planId: plan.id,
              planPriceAtPurchase: plan.price,
              idempotencyKey: idemKey ?? null,
              buyerUserId: dto.buyerUserId,
              note: dto.note ?? null,
              paymentMethod: 'WALLET',
            },
          },
          manager,
        );

        // 7) Idempotencia de movimiento por transactionId
        let movement = await this.walletMovRepo.findByTransactionId(
          tx.id,
          manager,
        );
        if (!movement) {
          // 7.1) Crear movimiento NEGATIVO por el débito del plan
          movement = await this.walletMovRepo.createAndSave(manager, {
            walletId: wallet.id,
            amount: -debit,
            previousBalance: previous,
            newBalance,
            transactionId: tx.id,
            note: dto.note ?? 'prepaid plan wallet purchase',
          });

          // 7.2) Actualizar saldo wallet (una pasada)
          await this.walletRepo.updateBalanceLocked(
            manager,
            wallet,
            newBalance,
          );

          // 7.3) (Opcional) bloquear si cruza a negativo por primera vez según política
          if (newBalance < 0 && previous >= 0) {
            await this.walletRepo.blockWalletLocked(
              manager,
              wallet,
              'negative_balance_on_plan_purchase',
            );
          }
        }

        // 8) Alta en user_prepaid_plans
        const purchaseDate = now;
        const expirationDate =
          plan.expiresInDays != null
            ? new Date(
                purchaseDate.getTime() +
                  plan.expiresInDays * 24 * 60 * 60 * 1000,
              )
            : null;
        const tripsRemaining = plan.tripsIncluded ?? null;

        const userPlan = await this.userPlanRepo.createAndSave(
          {
            userId: dto.buyerUserId,
            planId: plan.id,
            purchaseDate,
            expirationDate,
            tripsRemaining,
            status: UserPrepaidPlanStatus.ACTIVE,
            initialPurchaseTransactionId: tx.id,
          },
          manager,
        );

        // 9) Liability derivada (solo si es pack de viajes)
        const liability =
          plan.tripsIncluded && plan.tripsIncluded > 0
            ? (
                Number(plan.price) *
                (Number(userPlan.tripsRemaining ?? 0) / plan.tripsIncluded)
              ).toFixed(2)
            : null;

        const response: PurchasePrepaidPlanResponseDto = {
          userPrepaidPlanId: userPlan.id,
          planId: plan.id,
          buyerUserId: dto.buyerUserId,
          price: plan.price,
          currency: currency,
          tripsRemaining: userPlan.tripsRemaining ?? null,
          expirationDate: expirationDate?.toISOString() ?? null,
          transactionId: tx.id,
          liabilityEstimated: liability,
        };

        return response;
      },
      { logLabel: 'prepaid_plans.purchase_wallet' },
    );

    return {
      success: true,
      message: 'Prepaid plan purchased with wallet',
      data: result,
    };
  }
  /** Plan ACTIVO (mejor candidato) para un usuario. */
  async getActiveForUser(
    userId: string,
  ): Promise<ApiResponseDto<UserActivePrepaidPlanResponseDto | null>> {
    const up = await this.userPlanRepo.findActiveForUser(userId);
    if (!up) {
      return {
        success: true,
        message: 'No active prepaid plan for user',
        data: null,
      };
    }
    return {
      success: true,
      message: 'Active prepaid plan for user',
      data: mapUserPlanToActiveDto(up),
    };
  }
  /** (Opcional) Todos los planes activos del usuario con el mismo DTO. */
  async listActiveForUser(
    userId: string,
  ): Promise<ApiResponseDto<UserActivePrepaidPlanResponseDto[]>> {
    const rows = await this.userPlanRepo.findAllActiveForUser(userId);
    return {
      success: true,
      message: 'Active prepaid plans for user',
      data: rows.map(mapUserPlanToActiveDto),
    };
  }

  /**
   * Descuenta 1 viaje de una INSTANCIA concreta de user_prepaid_plans (lock FOR UPDATE).
   * Reglas:
   * - Debe estar ACTIVE
   * - Si está expirado -> se marca EXPIRED y se rechaza
   * - Debe tener contador (tripsRemaining != null)
   * - Debe quedar >= 0 luego del descuento
   * - Si queda en 0 -> status=USED
   */
  /**
   * Decrementa en 1 los viajes del **plan ACTIVO** del usuario.
   * - Requiere: plan activo, no expirado.
   * - Si el plan es PACK (plan.tripsIncluded != null) => trips_remaining > 0 o lanza 409.
   * - Si es DESCUENTO PURO (no-pack) => no toca trips_remaining (se mantiene null).
   * - Acepta `manager` para ejecutarse dentro de una TX; si no se provee, abre una TX corta.
   */
  async consumeOneForUser(
    userId: string,
    manager?: EntityManager,
  ): Promise<ConsumeOneResult> {
    const run = async (em: EntityManager): Promise<ConsumeOneResult> => {
      const usedAt = new Date();

      // 1) Encontrar el plan ACTIVO del usuario (tu repo ya filtra por activo, no expirado y con trips>0 si es pack)
      const active = await this.userPlanRepo.findActiveForUser(userId, em);
      if (!active) {
        throw new NotFoundException('User has no active prepaid plan');
      }

      // 2) Releer con LOCK FOR UPDATE (para evitar carreras) + join plan
      const up = await em
        .getRepository(UserPrepaidPlan)
        .createQueryBuilder('up')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('up.plan', 'p')
        .where('up._id = :id', { id: active.id })
        .getOne();

      if (!up) {
        throw new NotFoundException('User prepaid plan not found');
      }

      // 3) Guardarraíles adicionales
      if (up.status !== UserPrepaidPlanStatus.ACTIVE) {
        throw new ConflictException(
          `User plan is not active (status=${up.status})`,
        );
      }
      if (up.expirationDate && up.expirationDate <= new Date()) {
        throw new ConflictException('User plan is expired');
      }

      const isPack = up.plan?.tripsIncluded != null;
      const current = up.tripsRemaining ?? null;

      if (isPack) {
        const hasTrips = (current ?? 0) > 0;
        if (!hasTrips) {
          throw new ConflictException('No trips remaining in pack');
        }
      }

      // 4) Calcular cambios
      let nextTrips: number | null = current;
      let nextStatus: UserPrepaidPlanStatus = up.status;

      if (isPack) {
        nextTrips = Math.max(0, (current ?? 0) - 1);
        nextStatus =
          (nextTrips ?? 0) <= 0
            ? UserPrepaidPlanStatus.USED
            : UserPrepaidPlanStatus.ACTIVE;
      } else {
        // descuento puro: no modificamos tripsRemaining (se mantiene null)
        nextTrips = null;
        nextStatus = UserPrepaidPlanStatus.ACTIVE;
      }

      // 5) Persistir
      up.tripsRemaining = nextTrips;
      up.lastUsedAt = usedAt;
      up.status = nextStatus;

      await em.getRepository(UserPrepaidPlan).save(up);

      // 6) Respuesta
      return {
        userPrepaidPlanId: up.id,
        userId: up.userId,
        planId: up.planId,
        tripsRemaining: up.tripsRemaining ?? null,
        status: up.status,
        lastUsedAt: up.lastUsedAt ? up.lastUsedAt.toISOString() : null,
      };
    };

    if (manager) {
      return run(manager);
    }
    return withQueryRunnerTx(this.dataSource, (_qr, em) => run(em), {
      logLabel: 'user_prepaid_plans.consume_one_for_user',
    });
  }
  /**
   * Ejecuta el job de expiración:
   * - Marca EXPIRED todos los user_prepaid_plans vencidos (ACTIVE y expiration_date <= now).
   * - Devuelve contadores útiles para logs/observabilidad.
   *
   * Sugerido para correrse a las 00:00 (timezone de tu instancia).
   * Si lo invocas con `manager`, reutiliza la TX; si no, abre una TX corta.
   */
  async expireDueUserPlans(
    now = new Date(),
    manager?: EntityManager,
  ): Promise<{
    runAt: string;
    expiredCount: number;
  }> {
    const run = async (em: EntityManager) => {
      const affected = await this.userPlanRepo.bulkExpireDue(now, em);
      this.logger.log(
        `expireDueUserPlans: expired=${affected} at=${now.toISOString()}`,
      );
      return {
        runAt: now.toISOString(),
        expiredCount: affected,
      };
    };

    if (manager) return run(manager);

    return withQueryRunnerTx(this.dataSource, (_qr, em) => run(em), {
      logLabel: 'prepaid_plans.cron_expire_due',
    });
  }
}

/** Helpers */
const toISO = (d?: Date | null) =>
  d instanceof Date ? d.toISOString() : (d ?? null);

/** Mapper de Entity → ResponseDto */
function toPrepaidPlanResponseDto(p: PrepaidPlan): PrepaidPlanResponseDto {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    tripsIncluded: p.tripsIncluded ?? null,
    discountPct: p.discountPct ?? null,
    fixedDiscountAmount: p.fixedDiscountAmount ?? null,
    expiresInDays: p.expiresInDays ?? null,
    price: p.price,
    currency: p.currency,
    isActive: p.isActive,
    planFeatures: (p as any).planFeatures ?? null,
    createdAt: toISO(p.createdAt)!,
    updatedAt: toISO(p.updatedAt)!,
  };
}

function mapUserPlanToActiveDto(
  up: UserPrepaidPlan,
): UserActivePrepaidPlanResponseDto {
  const plan = (up as any).plan as PrepaidPlan | undefined;

  const priceNum = Number(plan?.price ?? 0);
  const tripsIncluded = plan?.tripsIncluded ?? null;
  const tripsRemaining = up.tripsRemaining ?? null;

  const liabilityEstimated =
    tripsIncluded && tripsIncluded > 0 && tripsRemaining != null
      ? (priceNum * (Number(tripsRemaining) / tripsIncluded)).toFixed(2)
      : null;

  return {
    userPrepaidPlanId: up.id,
    userId: up.userId,
    planId: up.planId,
    planName: plan?.name ?? 'Prepaid Plan',
    planDescription: plan?.description ?? null,
    tripsIncluded,
    discountPct: plan?.discountPct ?? null,
    fixedDiscountAmount: plan?.fixedDiscountAmount ?? null,
    expiresInDays: plan?.expiresInDays ?? null,
    price: plan?.price ?? '0',
    currency: plan?.currency ?? 'CUP',
    planFeatures: (plan as any)?.planFeatures ?? null,
    tripsRemaining,
    expirationDate:
      up.expirationDate instanceof Date
        ? up.expirationDate.toISOString()
        : (up.expirationDate ?? null),
    liabilityEstimated,
  };
}
