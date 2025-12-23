import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { PricePolicyRepository } from '../repositories/price-policy.repository';
import { CreatePricePolicyDto } from '../dtos/create-price-policy.dto';
import { UpdatePricePolicyDto } from '../dtos/update-price-policy.dto';
import { PricePoliciesQueryDto } from '../dtos/price-policies-query.dto';
import { withQueryRunnerTx } from 'src/common/utils/tx.util';

import { CityRepository } from '../../cities/repositories/city.repository';
import { ZoneRepository } from '../../zones/repositories/zone.repository';
import {
  PricePolicy,
  PricePolicyScopeType,
} from '../entities/price-policy.entity';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { paginated } from 'src/common/utils/response-helpers';

@Injectable()
export class PricePolicyService {
  private readonly logger = new Logger(PricePolicyService.name);

  constructor(
    private readonly pricePolicyRepo: PricePolicyRepository,
    private readonly cityRepo: CityRepository,
    private readonly zoneRepo: ZoneRepository,
    private readonly dataSource: DataSource,
  ) {}

  /** Listado paginado */
  async findAll(
    q: PricePoliciesQueryDto,
  ): Promise<ApiResponseDto<PricePolicy[], PaginationMetaDto>> {
    const { page = 1, limit = 10 } = q;

    const [rows, total] = await this.pricePolicyRepo.findAllPaginated(
      { page, limit },
      q,
    );

    return paginated(rows, total, page, limit, 'Price policies retrieved');
  }

  /** Detalle por id */
  async getById(id: string): Promise<ApiResponseDto<PricePolicy>> {
    const entity = await this.pricePolicyRepo.findById(id, { relations: true });
    if (!entity) throw new NotFoundException('Price policy not found');

    return { success: true, message: 'Price policy retrieved', data: entity };
  }

  /** Crear */
  async create(
    dto: CreatePricePolicyDto,
  ): Promise<ApiResponseDto<PricePolicy>> {
    this.assertScopeCoherence(dto);

    // Validación de vigencia (si vienen ambos)
    if (dto.effectiveFrom && dto.effectiveTo) {
      if (new Date(dto.effectiveTo) <= new Date(dto.effectiveFrom)) {
        throw new BadRequestException('effectiveTo must be > effectiveFrom');
      }
    }

    const created = await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        // Validar existencia de FK según scope
        if (dto.scopeType === PricePolicyScopeType.CITY) {
          const c = await this.cityRepo.findById(dto.cityId!, manager);
          if (!c) throw new BadRequestException('City not found');
        }
        if (dto.scopeType === PricePolicyScopeType.ZONE) {
          const z = await this.zoneRepo.findById(dto.zoneId!, manager);
          if (!z) throw new BadRequestException('Zone not found');
        }

        const entity = await this.pricePolicyRepo.createAndSave(
          {
            name: dto.name,
            scopeType: dto.scopeType,

            cityId:
              dto.scopeType === PricePolicyScopeType.CITY
                ? (dto.cityId ?? null)
                : null,
            zoneId:
              dto.scopeType === PricePolicyScopeType.ZONE
                ? (dto.zoneId ?? null)
                : null,

            active: dto.active ?? true,
            priority: dto.priority ?? 100,

            effectiveFrom: dto.effectiveFrom
              ? new Date(dto.effectiveFrom)
              : null,
            effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,

            timezone: dto.timezone ?? 'UTC',
            conditions: (dto.conditions ?? {}) as any,
            price: dto.price as any,
            updatedBy: dto.updatedBy ?? null,
          },
          manager,
        );

        return entity;
      },
      { logLabel: 'price_policy.create' } as any,
    );

    // refrescar con relaciones (opcional)
    const full = await this.pricePolicyRepo.findById(created.id, {
      relations: true,
    });

    return { success: true, message: 'Price policy created', data: full! };
  }

  /** Update parcial */
  async update(
    id: string,
    dto: UpdatePricePolicyDto,
  ): Promise<ApiResponseDto<PricePolicy>> {
    const existing = await this.pricePolicyRepo.findById(id, {
      relations: false,
    });
    if (!existing) throw new NotFoundException('Price policy not found');

    // Si toca scope/cityId/zoneId, valida coherencia sobre el DTO “resultante”
    const merged: any = {
      scopeType: dto.scopeType ?? existing.scopeType,
      cityId: dto.cityId !== undefined ? dto.cityId : existing.cityId,
      zoneId: dto.zoneId !== undefined ? dto.zoneId : existing.zoneId,
    };
    this.assertScopeCoherence(merged);

    // Validación de vigencia (considerando merge)
    const effFrom =
      dto.effectiveFrom !== undefined
        ? dto.effectiveFrom
          ? new Date(dto.effectiveFrom)
          : null
        : existing.effectiveFrom;

    const effTo =
      dto.effectiveTo !== undefined
        ? dto.effectiveTo
          ? new Date(dto.effectiveTo)
          : null
        : existing.effectiveTo;

    if (effFrom && effTo && effTo <= effFrom) {
      throw new BadRequestException('effectiveTo must be > effectiveFrom');
    }

    const updated = await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        // Validar FK si cambió o si scope lo requiere
        const scope = merged.scopeType as PricePolicyScopeType;

        if (scope === PricePolicyScopeType.CITY) {
          const cid = merged.cityId;
          if (!cid)
            throw new BadRequestException('cityId is required for CITY');
          const c = await this.cityRepo.findById(cid, manager);
          if (!c) throw new BadRequestException('City not found');
        }

        if (scope === PricePolicyScopeType.ZONE) {
          const zid = merged.zoneId;
          if (!zid)
            throw new BadRequestException('zoneId is required for ZONE');
          const z = await this.zoneRepo.findById(zid, manager);
          if (!z) throw new BadRequestException('Zone not found');
        }

        // Patch final
        const patch: any = {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.scopeType !== undefined && { scopeType: dto.scopeType }),

          // normalizar ids según scope final
          cityId:
            scope === PricePolicyScopeType.CITY
              ? (merged.cityId ?? null)
              : null,
          zoneId:
            scope === PricePolicyScopeType.ZONE
              ? (merged.zoneId ?? null)
              : null,

          ...(dto.active !== undefined && { active: dto.active }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          ...(dto.effectiveFrom !== undefined && { effectiveFrom: effFrom }),
          ...(dto.effectiveTo !== undefined && { effectiveTo: effTo }),
          ...(dto.timezone !== undefined && {
            timezone: dto.timezone ?? 'UTC',
          }),
          ...(dto.conditions !== undefined && {
            conditions: dto.conditions ?? {},
          }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.updatedBy !== undefined && {
            updatedBy: dto.updatedBy ?? null,
          }),
        };

        const u = await this.pricePolicyRepo.updatePartial(id, patch, manager);
        return u;
      },
      { logLabel: 'price_policy.update' } as any,
    );

    const full = await this.pricePolicyRepo.findById(updated.id, {
      relations: true,
    });
    return { success: true, message: 'Price policy updated', data: full! };
  }

  /** Activar / desactivar */
  async setActive(
    id: string,
    active: boolean,
    updatedBy?: string | null,
  ): Promise<ApiResponseDto<PricePolicy>> {
    const existing = await this.pricePolicyRepo.findById(id, {
      relations: false,
    });
    if (!existing) throw new NotFoundException('Price policy not found');

    const updated = await this.pricePolicyRepo.updatePartial(id, {
      active,
      ...(updatedBy !== undefined && { updatedBy }),
    });

    const full = await this.pricePolicyRepo.findById(updated.id, {
      relations: true,
    });

    return {
      success: true,
      message: `Price policy ${active ? 'activated' : 'deactivated'}`,
      data: full!,
    };
  }

  // ----------------- helpers -----------------

  /** Valida coherencia (además del CHECK en DB) */
  private assertScopeCoherence(dto: {
    scopeType: PricePolicyScopeType;
    cityId?: string | null;
    zoneId?: string | null;
  }) {
    const scope = dto.scopeType;
    const cityId = dto.cityId ?? null;
    const zoneId = dto.zoneId ?? null;

    if (scope === PricePolicyScopeType.GLOBAL) {
      if (cityId != null || zoneId != null) {
        throw new ConflictException(
          'GLOBAL scope requires cityId and zoneId to be null',
        );
      }
    }

    if (scope === PricePolicyScopeType.CITY) {
      if (!cityId || zoneId != null) {
        throw new ConflictException(
          'CITY scope requires cityId (non-null) and zoneId null',
        );
      }
    }

    if (scope === PricePolicyScopeType.ZONE) {
      if (!zoneId || cityId != null) {
        throw new ConflictException(
          'ZONE scope requires zoneId (non-null) and cityId null',
        );
      }
    }
  }
}
