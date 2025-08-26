import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { VehicleCategoryRepository } from '../repositories/vehicle-category.repository';
import { CreateVehicleCategoryDto } from '../dto/create-vehicle-category.dto';
import { UpdateVehicleCategoryDto } from '../dto/update-vehicle-category.dto';
import { VehicleCategoryFiltersDto } from '../dto/vehicle-category-filters.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import {
  formatErrorResponse,
  formatSuccessResponse,
  handleServiceError,
} from 'src/common/utils/api-response.utils';
import { VehicleCategory } from '../entities/vehicle-category.entity';
import { VehicleCategoryResponseDto } from '../dto/vehicle-category-response.dto';
// import { CreateVehicleCategoryResponseDto } from '../dto/create-vehicle-category-response.dto';

@Injectable()
export class VehicleCategoryService {
  private readonly logger = new Logger(VehicleCategoryService.name);

  constructor(private readonly repo: VehicleCategoryRepository) {}

  async findAll(
    pagination: PaginationDto,
    filters?: VehicleCategoryFiltersDto,
  ): Promise<ApiResponse<VehicleCategory[]>> {
    try {
      const [items, total] = await this.repo.findAllPaginated(
        pagination,
        filters,
      );
      return formatSuccessResponse<VehicleCategory[]>(
        'Vehicle categories retrieved successfully',
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
        ...formatErrorResponse<VehicleCategory[]>(
          'Error fetching vehicle categories',
          typedError.code,
          typedError,
        ),
        data: [],
      };
    }
  }

  async findById(id: string): Promise<ApiResponse<VehicleCategory>> {
    try {
      const category = await this.repo.findById(id);
      if (!category) {
        return formatErrorResponse<VehicleCategory>(
          'Vehicle category not found',
          'NOT_FOUND',
        );
      }
      return formatSuccessResponse<VehicleCategory>(
        'Vehicle category retrieved successfully',
        category,
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

      return formatErrorResponse<VehicleCategory>(
        'Error fetching vehicle category',
        typedError.code,
        typedError,
      );
    }
  }

  async create(
    dto: CreateVehicleCategoryDto,
  ): Promise<ApiResponse<VehicleCategoryResponseDto>> {
    try {
      // 1) Chequeamos si existe
      const existing = await this.repo.findByName(dto.name);
      if (existing) {
        throw new ConflictException(
          `VehicleCategory with name "${dto.name}" already exists`,
        );
      }

      const category = await this.repo.createAndSave(dto);

      // 2) Mapeamos a DTO de respuesta
      const data: VehicleCategoryResponseDto = {
        id: category.id,
        name: category.name,
        description: category.description ?? undefined,
        iconUrl: category.iconUrl ?? undefined,
        isActive: category.isActive,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
        deletedAt: category.deletedAt?.toISOString(),
      };

      return {
        success: true,
        message: 'Vehicle category created successfully',
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

      return handleServiceError<VehicleCategoryResponseDto>(
        this.logger,
        err,
        'VehicleCategoryService.create',
      );
    }
  }
  /**
   * Updates a vehicle´s category by ID without a transaction.
   * @param id - UUID of the VehicleCategory
   * @param dto - Partial DTO containing updatable fields
   * @returns ApiResponse containing updated VehicleCategory or error info
   */
  async update(
    id: string,
    dto: UpdateVehicleCategoryDto,
  ): Promise<ApiResponse<VehicleCategory>> {
    try {
      const existing = await this.repo.findById(id);
      if (!existing) {
        throw new NotFoundException(`Vehicle Category ${id} not found`);
      }
      // opcional: si el nombre cambia, puedes validar duplicado previo
      if (dto.name && dto.name !== existing.name) {
        const byName = await this.repo.findByName(dto.name);
        if (byName && byName.id !== id) {
          return formatErrorResponse<VehicleCategory>(
            `Vehicle category name "${dto.name}" already exists`,
            'CATEGORY_NAME_CONFLICT',
          );
        }
      }
      const updated = await this.repo.save({ ...existing, ...dto });
      return formatSuccessResponse<VehicleCategory>(
        'Vehicle Category updated successfully',
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
          dbError.detail?.includes('vehicle_category_name')
        ) {
          this.logger.warn(
            `Vehicle category name conflict on update: ${dto.name}`,
          );
          return formatErrorResponse<VehicleCategory>(
            'Vehicle category name conflict',
            'CATEGORY_NAME_CONFLICT',
          );
        }
      }

      if (error instanceof NotFoundException) {
        return formatErrorResponse<VehicleCategory>(error.message, 'NOT_FOUND');
      }

      const err = error as Error;
      this.logger.error(`update failed for VehicleCategory ${id}`, err.stack);
      return formatErrorResponse<VehicleCategory>(
        'Failed to update vehicle category',
        err.name,
      );
    }
  }

  async remove(id: string): Promise<ApiResponse<null>> {
    try {
      const category = await this.repo.findById(id);
      if (!category)
        throw new NotFoundException(`VehicleCategory ${id} not found`);
      await this.repo.softDeleteCategory(id);
      return formatSuccessResponse<null>(
        'Vehicle category deleted successfully',
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
          'Database error deleting vehicle category',
          pgErr.code,
          pgErr.detail,
        );
      }

      // Cualquier otro error:
      return formatErrorResponse<null>(
        'Error deleting vehicle category',
        err instanceof Error ? err.message : 'DELETE_ERROR',
        err,
      );
    }
  }
}
