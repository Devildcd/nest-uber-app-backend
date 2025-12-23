import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CityRepository } from '../repositories/city.repository';
import { DataSource } from 'typeorm';
import { CitiesQueryDto } from '../dtos/cities-query.dto';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import {
  CityListItemDto,
  CityResponseDto,
  toCityListItemDto,
  toCityResponseDto,
} from '../dtos/city-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { CreateCityDto } from '../dtos/create-city.dto';
import { UpdateCityDto } from '../dtos/update-city.dto';
import { withQueryRunnerTx } from 'src/common/utils/tx.util';
import { paginated } from 'src/common/utils/response-helpers';

@Injectable()
export class CityService {
  private readonly logger = new Logger(CityService.name);

  constructor(
    private readonly cityRepo: CityRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Lista paginada (envelope estándar).
   * Nota: para listado normalmente NO mandamos geom (pesado) => CityListItemDto.
   */
  async findAll(
    q: CitiesQueryDto,
  ): Promise<ApiResponseDto<CityListItemDto[], PaginationMetaDto>> {
    const { page = 1, limit = 10 } = q;

    const [entities, total] = await this.cityRepo.findAllPaginated(
      { page, limit },
      q,
    );
    const items = entities.map(toCityListItemDto);

    return paginated(items, total, page, limit, 'Cities retrieved');
  }

  /** Detalle por id */
  async getById(id: string): Promise<ApiResponseDto<CityResponseDto>> {
    const city = await this.cityRepo.findById(id);
    if (!city) throw new NotFoundException('City not found');

    return {
      success: true,
      message: 'City retrieved',
      data: toCityResponseDto(city),
    };
  }

  /**
   * Crear ciudad.
   * - Valida duplicados por (name,countryCode).
   * - TX corta para: crear + (opcional) set geom con SRID (tu repo updatePartial ya lo maneja).
   */
  async create(dto: CreateCityDto): Promise<ApiResponseDto<CityResponseDto>> {
    const existing = await this.cityRepo.findByNameCountry(
      dto.name,
      dto.countryCode,
    );
    if (existing) {
      throw new ConflictException('City already exists (name + countryCode)');
    }

    const createdId = await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        // 1) crear sin geom (o geom=null) para evitar líos de SRID en insert
        const base = await this.cityRepo.createAndSave(
          {
            name: dto.name,
            countryCode: dto.countryCode,
            timezone: dto.timezone,
            active: dto.active ?? true,
            geom: null,
          } as any,
          manager,
        );

        // 2) si viene geom explícito (null u objeto) => aplicar con updatePartial (maneja SRID=4326)
        if (dto.geom !== undefined) {
          await this.cityRepo.updatePartial(
            base.id,
            { geom: dto.geom ?? null } as any,
            manager,
          );
        }

        return base.id;
      },
      { logLabel: 'city.create' } as any,
    );

    const fresh = await this.cityRepo.findById(createdId);
    return {
      success: true,
      message: 'City created',
      data: toCityResponseDto(fresh!),
    };
  }

  /**
   * Update/Patch.
   * - Lock FOR UPDATE (evita carreras).
   * - Revisa duplicados si cambia (name,countryCode).
   */
  async update(
    id: string,
    dto: UpdateCityDto,
  ): Promise<ApiResponseDto<CityResponseDto>> {
    // leemos fuera para poder armar “next values” y validar unique
    const current = await this.cityRepo.findById(id);
    if (!current) throw new NotFoundException('City not found');

    const nextName = dto.name ?? current.name;
    const nextCountry = dto.countryCode ?? current.countryCode;

    // Si potencialmente cambia la llave unique, validamos duplicado
    if (nextName !== current.name || nextCountry !== current.countryCode) {
      const dup = await this.cityRepo.findByNameCountry(nextName, nextCountry);
      if (dup && dup.id !== id) {
        throw new ConflictException(
          'Another city already exists (name + countryCode)',
        );
      }
    }

    await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        const locked = await this.cityRepo.lockByIdForUpdate(id, manager);
        if (!locked) throw new NotFoundException('City not found');

        const patch: any = {};
        if (dto.name !== undefined) patch.name = dto.name;
        if (dto.countryCode !== undefined) patch.countryCode = dto.countryCode;
        if (dto.timezone !== undefined) patch.timezone = dto.timezone;
        if (dto.active !== undefined) patch.active = dto.active;
        if (dto.geom !== undefined) patch.geom = dto.geom ?? null;

        await this.cityRepo.updatePartial(id, patch, manager);
      },
      { logLabel: 'city.update' } as any,
    );

    const fresh = await this.cityRepo.findById(id);
    return {
      success: true,
      message: 'City updated',
      data: toCityResponseDto(fresh!),
    };
  }

  /** Activar / desactivar (soft) */
  async setActive(
    id: string,
    active: boolean,
  ): Promise<ApiResponseDto<CityResponseDto>> {
    await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        const locked = await this.cityRepo.lockByIdForUpdate(id, manager);
        if (!locked) throw new NotFoundException('City not found');

        await this.cityRepo.updatePartial(id, { active } as any, manager);
      },
      { logLabel: 'city.setActive' } as any,
    );

    const fresh = await this.cityRepo.findById(id);
    return {
      success: true,
      message: active ? 'City activated' : 'City deactivated',
      data: toCityResponseDto(fresh!),
    };
  }

  /**
   * Resolver ciudad por punto (si tienes geom).
   * Útil para: “¿en qué ciudad cae este punto?”
   */
  async resolveByPoint(point: {
    lat: number;
    lng: number;
  }): Promise<ApiResponseDto<CityListItemDto | null>> {
    const city = await this.cityRepo.findByPoint(point, { onlyActive: true });

    return {
      success: true,
      message: 'City resolved by point',
      data: city ? toCityListItemDto(city) : null,
    };
  }
}
