import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ZoneRepository } from '../repositories/zone.repository';
import { CityRepository } from '../../cities/repositories/city.repository';
import { ZonesQueryDto } from '../dtos/zones-query.dto';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import {
  toZoneListItemDto,
  toZoneResponseDto,
  ZoneListItemDto,
  ZoneResponseDto,
} from '../dtos/zone-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { paginated } from 'src/common/utils/response-helpers';
import { CreateZoneDto } from '../dtos/create-zone.dto';
import { withQueryRunnerTx } from 'src/common/utils/tx.util';
import { UpdateZoneDto } from '../dtos/update-zone.dto';

@Injectable()
export class ZoneService {
  private readonly logger = new Logger(ZoneService.name);

  constructor(
    private readonly zoneRepo: ZoneRepository,
    private readonly cityRepo: CityRepository,
    private readonly dataSource: DataSource,
  ) {}

  /** Lista paginada */
  async findAll(
    q: ZonesQueryDto,
  ): Promise<ApiResponseDto<ZoneListItemDto[], PaginationMetaDto>> {
    const { page = 1, limit = 10 } = q;

    const [entities, total] = await this.zoneRepo.findAllPaginated(
      { page, limit },
      q,
    );

    const items = entities.map(toZoneListItemDto);
    return paginated(items, total, page, limit, 'Zones retrieved');
  }

  /** Detalle por id (con city opcional si lo quieres) */
  async getById(id: string): Promise<ApiResponseDto<ZoneResponseDto>> {
    const zone = await this.zoneRepo.findByIdWithRelations(id, ['city']);
    if (!zone) throw new NotFoundException('Zone not found');

    return {
      success: true,
      message: 'Zone retrieved',
      data: toZoneResponseDto(zone),
    };
  }

  /** Crear zona */
  async create(dto: CreateZoneDto): Promise<ApiResponseDto<ZoneResponseDto>> {
    // Guardarraíles
    if (!dto.geom) throw new BadRequestException('geom is required');

    // Validar city existe
    const city = await this.cityRepo.findById(dto.cityId);
    if (!city) throw new NotFoundException('City not found');

    // Unique (cityId, name)
    const dup = await this.zoneRepo.findByCityAndName(dto.cityId, dto.name);
    if (dup) throw new ConflictException('Zone already exists in this city');

    const zoneId = await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        // Creamos base (sin geom directo) y luego set geom con SRID=4326 vía updatePartial
        const created = await this.zoneRepo.createAndSave(
          {
            city: { id: dto.cityId } as any,
            name: dto.name,
            kind: dto.kind ?? null,
            priority: dto.priority ?? 100,
            active: dto.active ?? true,
            // geom en NOT NULL: lo seteamos inmediatamente en el updatePartial
            geom: dto.geom,
          } as any,
          manager,
        );

        // Set geom SRID=4326 (obligatorio)
        await this.zoneRepo.updatePartial(
          created.id,
          { geom: dto.geom } as any,
          manager,
        );

        return created.id;
      },
      { logLabel: 'zone.create' } as any,
    );

    const fresh = await this.zoneRepo.findByIdWithRelations(zoneId, ['city']);
    return {
      success: true,
      message: 'Zone created',
      data: toZoneResponseDto(fresh!),
    };
  }

  /** Update/Patch */
  async update(
    id: string,
    dto: UpdateZoneDto,
  ): Promise<ApiResponseDto<ZoneResponseDto>> {
    if (dto.cityId !== undefined) {
      throw new BadRequestException(
        'cityId cannot be changed (create a new zone)',
      );
    }
    if (dto.geom === null) {
      throw new BadRequestException('geom cannot be null');
    }

    // Leemos para validar unique si cambia name
    const current = await this.zoneRepo.findById(id);
    if (!current) throw new NotFoundException('Zone not found');

    const nextName = dto.name ?? current.name;

    if (nextName !== current.name) {
      const dup = await this.zoneRepo.findByCityAndName(
        current.cityId,
        nextName,
      );
      if (dup && dup.id !== id) {
        throw new ConflictException(
          'Another zone with that name already exists in this city',
        );
      }
    }

    await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        const locked = await this.zoneRepo.lockByIdForUpdate(id, manager);
        if (!locked) throw new NotFoundException('Zone not found');

        const patch: any = {};
        if (dto.name !== undefined) patch.name = dto.name;
        if (dto.kind !== undefined) patch.kind = dto.kind ?? null;
        if (dto.priority !== undefined) patch.priority = dto.priority;
        if (dto.active !== undefined) patch.active = dto.active;

        if (dto.geom !== undefined) {
          if (dto.geom == null)
            throw new BadRequestException('geom cannot be null');
          patch.geom = dto.geom;
        }

        await this.zoneRepo.updatePartial(id, patch, manager);
      },
      { logLabel: 'zone.update' } as any,
    );

    const fresh = await this.zoneRepo.findByIdWithRelations(id, ['city']);
    return {
      success: true,
      message: 'Zone updated',
      data: toZoneResponseDto(fresh!),
    };
  }

  /** Activar / desactivar */
  async setActive(
    id: string,
    active: boolean,
  ): Promise<ApiResponseDto<ZoneResponseDto>> {
    await withQueryRunnerTx(
      this.dataSource,
      async (_qr, manager) => {
        const locked = await this.zoneRepo.lockByIdForUpdate(id, manager);
        if (!locked) throw new NotFoundException('Zone not found');

        await this.zoneRepo.updatePartial(id, { active } as any, manager);
      },
      { logLabel: 'zone.setActive' } as any,
    );

    const fresh = await this.zoneRepo.findByIdWithRelations(id, ['city']);
    return {
      success: true,
      message: active ? 'Zone activated' : 'Zone deactivated',
      data: toZoneResponseDto(fresh!),
    };
  }

  /**
   * Resolver mejor zona para un punto dentro de una ciudad.
   * (para pricing: si hay overlaps, gana priority desc)
   */
  async resolveBestZoneByPoint(
    cityId: string,
    point: { lat: number; lng: number },
  ): Promise<ApiResponseDto<ZoneListItemDto | null>> {
    const zone = await this.zoneRepo.findBestByPoint(cityId, point, {
      onlyActive: true,
    });
    return {
      success: true,
      message: 'Zone resolved by point',
      data: zone ? toZoneListItemDto(zone) : null,
    };
  }
}
