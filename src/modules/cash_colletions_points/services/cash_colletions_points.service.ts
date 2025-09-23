import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CashCollectionPointRepository } from '../repositories/cash_colletion_points.repository';
import { CashCollectionPoint } from '../entities/cash_colletions_points.entity';
import { CreateCashCollectionPointDto } from '../dto/create-cash_colletions_points.dto';

@Injectable()
export class CashColletionsPointsService {
  private readonly logger = new Logger(CashColletionsPointsService.name);

  constructor(private readonly repo: CashCollectionPointRepository) {}
  /**
   * Crea y persiste un CashCollectionPoint.
   * Transforma location array -> GeoJSON Point antes de delegar al repo.
   */
  async create(
    dto: CreateCashCollectionPointDto,
  ): Promise<CashCollectionPoint> {
    try {
      const pointData: Partial<CashCollectionPoint> = {
        name: dto.name,
        address: dto.address ?? undefined,
        contactPhone: dto.contactPhone ?? undefined,
        openingHours: dto.openingHours ?? undefined,
        isActive: dto.isActive ?? true,
      };

      if (
        dto.location &&
        Array.isArray(dto.location) &&
        dto.location.length >= 2
      ) {
        pointData.location = {
          type: 'Point',
          coordinates: [dto.location[0], dto.location[1]],
        } as any;
      } else {
        pointData.location = null;
      }

      const saved = await this.repo.createAndSave(pointData);
      return saved;
    } catch (err) {
      this.logger.error('create CashCollectionPoint failed', err);
      // repo already handles mapping/logging; translate to HTTP-level error
      throw new InternalServerErrorException(
        err.message || 'Error creating collection point',
      );
    }
  }

  /**
   * Obtener punto por id (útil después de crear)
   */
  async findById(id: string): Promise<CashCollectionPoint | null> {
    return this.repo.findById(id);
  }
}
