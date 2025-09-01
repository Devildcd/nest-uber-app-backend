import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { VehicleServiceClassRepository } from '../repositories/vehicle-service-classes.repository';
import { CreateVehicleServiceClassDto } from '../dto/create-vehicle-service-class.dto';
import { UpdateVehicleServiceClassDto } from '../dto/update-vehicle-service-class.dto';
import { VehicleServiceClassFiltersDto } from '../dto/vehicle-service-class-filter.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import {
  formatErrorResponse,
  formatSuccessResponse,
  handleServiceError,
} from 'src/common/utils/api-response.utils';
import { VehicleServiceClass } from '../entities/vehicle-service-classes.entity';
import { VehicleServiceClassResponseDto } from '../dto/vehicle-service-class-response.dto';

@Injectable()
export class VehicleServiceClassesService {
  private readonly logger = new Logger(VehicleServiceClassesService.name);

  constructor(private readonly repo: VehicleServiceClassRepository) {}

  async findAll(
    pagination: PaginationDto,
    filters?: VehicleServiceClassFiltersDto,
  ): Promise<ApiResponse<VehicleServiceClass[]>> {
    try {
      const [items, total] = await this.repo.findAllPaginated(
        pagination,
        filters,
      );
      return formatSuccessResponse<VehicleServiceClass[]>(
        'Vehicle service classes retrieved successfully',
        items,
        { total, page: pagination.page ?? 1, limit: pagination.limit ?? 10 },
      );
    } catch (error: any) {
      this.logger.error(
        'findAll failed',
        (error instanceof Error ? error.stack : undefined) ||
          (typeof error === 'object' && 'message' in error
            ? (error as { message: string }).message
            : String(error)),
      );
      const typedError = error as {
        code?: string;
        message?: string;
        stack?: string;
      };

      return {
        ...formatErrorResponse<VehicleServiceClass[]>(
          'Error fetching vehicle service classes',
          typedError.code,
          typedError,
        ),
        data: [],
      };
    }
  }

  async findById(id: string): Promise<ApiResponse<VehicleServiceClass>> {
    try {
      const service = await this.repo.findById(id);
      if (!service) {
        return formatErrorResponse<VehicleServiceClass>(
          'Vehicle service class not found',
          'NOT_FOUND',
        );
      }
      return formatSuccessResponse<VehicleServiceClass>(
        'Vehicle service class retrieved successfully',
        service,
      );
    } catch (error: any) {
      this.logger.error(
        'findById failed',
        (error instanceof Error ? error.stack : undefined) ||
          (typeof error === 'object' && 'message' in error
            ? (error as { message: string }).message
            : String(error)),
      );

      const typedError = error as {
        code?: string;
        message?: string;
        stack?: string;
      };

      return formatErrorResponse<VehicleServiceClass>(
        'Error fetching vehicle service class',
        typedError.code,
        typedError,
      );
    }
  }

  async create(
    dto: CreateVehicleServiceClassDto,
  ): Promise<ApiResponse<VehicleServiceClassResponseDto>> {
    try {
      // 1) Chequeamos si existe
      const existing = await this.repo.findByName(dto.name);
      if (existing) {
        throw new ConflictException(
          `VehicleServiceClass with name "${dto.name}" already exists`,
        );
      }

      const service = await this.repo.createAndSave(dto);

      // 2) Mapeamos a DTO de respuesta
      const data: VehicleServiceClassResponseDto = {
        id: service.id,
        name: service.name,
        description: service.description ?? undefined,
        baseFareMultiplier: service.baseFareMultiplier,
        costPerKmMultiplier: service.costPerKmMultiplier,
        costPerMinuteMultiplier: service.costPerMinuteMultiplier,
        minCapacity: service.minCapacity,
        minFareMultiplier: service.minFareMultiplier,
        maxCapacity: service.maxCapacity,
        iconUrl: service.iconUrl ?? undefined,
        isActive: service.isActive,
        createdAt: service.createdAt.toISOString(),
        updatedAt: service.updatedAt.toISOString(),
        deletedAt: service.deletedAt?.toISOString(),
      };

      return {
        success: true,
        message: 'Vehicle service class created successfully',
        data,
      };
    } catch (err: any) {
      if (err instanceof QueryFailedError) {
        const pgErr = err.driverError as { code: string; detail?: string };
        if (pgErr.code === '23505') {
          return formatErrorResponse(
            'Resource conflict',
            'CONFLICT_ERROR',
            pgErr.detail,
          );
        }
      }
      if (err instanceof NotFoundException) {
        return formatErrorResponse(
          'Resource not found',
          'NOT_FOUND',
          err.message,
        );
      }
      if (err instanceof BadRequestException) {
        return formatErrorResponse(
          'Invalid request',
          'BAD_REQUEST',
          err.message,
        );
      }

      return handleServiceError<VehicleServiceClassResponseDto>(
        this.logger,
        err,
        'VehicleServiceClass.create',
      );
    }
  }
  /**
   * Updates a vehicle´s service class by ID without a transaction.
   * @param id - UUID of the VehicleServiceClass
   * @param dto - Partial DTO containing updatable fields
   * @returns ApiResponse containing updated VehicleCategory or error info
   */
  async update(
    id: string,
    dto: UpdateVehicleServiceClassDto,
  ): Promise<ApiResponse<VehicleServiceClass>> {
    try {
      const existing = await this.repo.findById(id);
      if (!existing) {
        throw new NotFoundException(`Vehicle Service Class ${id} not found`);
      }
      if (dto.name && dto.name !== existing.name) {
        const byName = await this.repo.findByName(dto.name);
        if (byName && byName.id !== id) {
          return formatErrorResponse<VehicleServiceClass>(
            `Vehicle service class name "${dto.name}" already exists`,
            'SERVICE_CLASS_NAME_CONFLICT',
          );
        }
      }
      const updated = await this.repo.save({ ...existing, ...dto });
      return formatSuccessResponse<VehicleServiceClass>(
        'Vehicle Service Class updated successfully',
        updated,
      );
    } catch (error: unknown) {
      // Handle unique constraint violation
      if (error instanceof QueryFailedError) {
        const dbError = error.driverError as {
          code?: string;
          detail?: string;
        };
        if (
          dbError.code === '23505' &&
          dbError.detail?.includes('vehicle_service_name')
        ) {
          this.logger.warn(
            `Vehicle service class name conflict on update: ${dto.name}`,
          );
          return formatErrorResponse<VehicleServiceClass>(
            'Vehicle service class name conflict',
            'SERVICE_NAME_CONFLICT',
          );
        }
      }

      if (error instanceof NotFoundException) {
        return formatErrorResponse<VehicleServiceClass>(
          error.message,
          'NOT_FOUND',
        );
      }

      const err = error as Error;
      this.logger.error(
        `update failed for VehicleServiceClass ${id}`,
        err.stack,
      );
      return formatErrorResponse<VehicleServiceClass>(
        'Failed to update vehicle service class',
        err.name,
      );
    }
  }

  async remove(id: string): Promise<ApiResponse<null>> {
    try {
      const service = await this.repo.findById(id);
      if (!service)
        throw new NotFoundException(`VehicleServiceClass ${id} not found`);
      await this.repo.softDeleteService(id);
      return formatSuccessResponse<null>(
        'Vehicle service class deleted successfully',
        null,
      );
    } catch (err) {
      // err aquí lo tipamos como unknown y luego lo estrechamos
      this.logger.error(
        'remove failed',
        err instanceof Error ? err.stack : String(err),
      );

      // Si es un QueryFailedError de TypeORM, podemos detectar código con instanceof
      if (err instanceof QueryFailedError) {
        const pgErr = err.driverError as { code: string; detail?: string };
        return formatErrorResponse<null>(
          'Database error deleting vehicle service class',
          pgErr.code,
          pgErr.detail,
        );
      }

      // Cualquier otro error:
      return formatErrorResponse<null>(
        'Error deleting vehicle service class',
        err instanceof Error ? err.message : 'DELETE_ERROR',
        err,
      );
    }
  }
}
