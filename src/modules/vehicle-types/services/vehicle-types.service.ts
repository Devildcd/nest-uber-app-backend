import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, QueryFailedError, QueryRunner } from 'typeorm';
import { VehicleTypeRepository } from '../repositories/vehicle-types.repository';
import { CreateVehicleTypeDto } from '../dto/create-vehicle-types.dto';
import { UpdateVehicleTypeDto } from '../dto/update-vehicle-types.dto';
import { VehicleTypeFilterDto } from '../dto/vehicle-types-filter.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import {
  formatErrorResponse,
  formatSuccessResponse,
  handleServiceError,
} from 'src/common/utils/api-response.utils';
import { VehicleType } from '../entities/vehicle-types.entity';
import { VehicleServiceClass } from '../../vehicle-service-classes/entities/vehicle-service-classes.entity';
import { VehicleCategoryRepository } from '../../vehicle-category/repositories/vehicle-category.repository';
import { VehicleServiceClassRepository } from '../../vehicle-service-classes/repositories/vehicle-service-classes.repository';
import { VehicleTypeResponseDto } from '../dto/vehicle-types-response.dto';
import { DriverProfile } from 'src/modules/driver-profiles/entities/driver-profile.entity';

@Injectable()
export class VehicleTypesService {
  private readonly logger = new Logger(VehicleTypesService.name);
  constructor(
    private readonly repo: VehicleTypeRepository,
    private readonly vehicleCategoryRepository: VehicleCategoryRepository,
    private readonly vehicleServiceClassRepository: VehicleServiceClassRepository,
    private readonly dataSource: DataSource,
  ) {}
  async create(
    dto: CreateVehicleTypeDto,
  ): Promise<ApiResponse<VehicleTypeResponseDto>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificamos que no exista otro tipo de vehículo con el mismo nombre
      const existingType = await this.repo.findOne({
        where: { name: dto.name },
      });
      if (existingType) {
        throw new BadRequestException(
          'Vehicle type with this name already exists',
        );
      }
      // Verificamos que la categoría de vehículo exista
      const category = await this.vehicleCategoryRepository.findById(
        dto.categoryId,
      );
      if (!category) {
        throw new NotFoundException(`Vehicle ${dto.categoryId} not found`);
      }

      //Verificamos que las clases de servicio existan
      let serviceClasses: VehicleServiceClass[] = [];
      if (dto.serviceClassIds && dto.serviceClassIds.length > 0) {
        // Usamos el operador In para buscar todos los IDs de una vez
        serviceClasses = await queryRunner.manager.find(VehicleServiceClass, {
        where: { id: In(dto.serviceClassIds) },
    });


        // Verificamos si encontramos todas las clases de servicio
        if (serviceClasses.length !== dto.serviceClassIds.length) {
          const foundIds = serviceClasses.map((sc) => sc.id);
          const missingIds = dto.serviceClassIds.filter(
            (id) => !foundIds.includes(id),
          );
          throw new NotFoundException(
            `Vehicle service classes with IDs ${missingIds.join(', ')} not found`,
          );
        }
      }

      //Preparamos el objeto de creación
      const partial: Partial<VehicleType> = {
        ...dto,
        category: category,
        serviceClasses: serviceClasses,
      };
      // Persistimos en la transacción
      const vehicleType = await this.repo.createAndSave(
        partial,
        queryRunner.manager,
      );
      //await queryRunner.manager.save(vehicleType);
      await queryRunner.commitTransaction();

      // Recargamos la entidad con las relaciones para asegurarnos de tener todos los datos
      const savedVehicleType = await this.repo.findOne({
        where: { id: vehicleType.id },
        relations: ['category', 'serviceClasses'],
      });

      if (!savedVehicleType) {
        throw new NotFoundException('Vehicle type not found after creation');
      }

      //Mapeamos a DTO de respuesta
      const data: VehicleTypeResponseDto = {
        id: savedVehicleType.id,
        name: savedVehicleType.name,
        description: savedVehicleType.description,
        baseFare: savedVehicleType.baseFare,
        costPerKm: savedVehicleType.costPerKm,
        costPerMinute: savedVehicleType.costPerMinute,
        minFare: savedVehicleType.minFare,
        defaultCapacity: savedVehicleType.defaultCapacity,
        iconUrl: savedVehicleType.iconUrl,
        isActive: savedVehicleType.isActive,
        categoryId: savedVehicleType.category.id,
        categoryName: savedVehicleType.category.name,
        serviceClassIds: savedVehicleType.serviceClasses
          ? savedVehicleType.serviceClasses.map((sc) => sc.id)
          : [],
        serviceClassNames: savedVehicleType.serviceClasses
          ? savedVehicleType.serviceClasses.map((sc) => sc.name)
          : [],
        createdAt: savedVehicleType.createdAt.toISOString(),
        updatedAt: savedVehicleType.updatedAt.toISOString(),
      };

      return formatSuccessResponse<VehicleTypeResponseDto>(
        'Vehicle type created successfully',
        data,
      );
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      if (error instanceof QueryFailedError) {
        const pgErr = error.driverError as { code: string; detail?: string };
        if (pgErr.code === '23505') {
          return formatErrorResponse(
            'Resource conflict',
            'CONFLICT_ERROR',
            pgErr.detail,
          );
        }
      }
      if (error instanceof NotFoundException) {
        return formatErrorResponse(
          'Resource not found',
          'NOT_FOUND',
          error.message,
        );
      }
      if (error instanceof BadRequestException) {
        return formatErrorResponse(
          'Invalid request',
          'BAD_REQUEST',
          error.message,
        );
      }
      return handleServiceError<VehicleTypeResponseDto>(
        this.logger,
        error,
        'DriversService.create',
      );
    } finally {
      await queryRunner.release();
    }
  }
async findAll(
    pagination: PaginationDto,
    filters?: VehicleTypeFilterDto,
  ): Promise<ApiResponse<VehicleType[]>> {
    try {
      const [items, total] = await this.repo.findAllPaginated(
        pagination,
        filters,
    );
      return formatSuccessResponse<VehicleType[]>(
        'Vehicle type retrieved successfully',
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
        ...formatErrorResponse<VehicleType[]>(
          'Error fetching vehicle type',
          typedError.code,
          typedError,
        ),
        data: [],
      };
    }
  }

  async findById(id: string): Promise<ApiResponse<VehicleType>> {
    try {
      const type = await this.repo.findById(id);
      if (!type) {
        return formatErrorResponse<VehicleType>(
          'Vehicle type not found',
          'NOT_FOUND',
        );
      }
      return formatSuccessResponse<VehicleType>(
        'Vehicle type retrieved successfully',
        type,
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

      return formatErrorResponse<VehicleType>(
        'Error fetching vehicle type',
        typedError.code,
        typedError,
      );
    }
  }
async update(
    id: string,
    dto: UpdateVehicleTypeDto,
): Promise<ApiResponse<VehicleType>> {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingType = await queryRunner.manager.findOne(VehicleType, {
        where: { id },
        relations: ['category', 'serviceClasses'],
      });
      if (!existingType) {
        throw new NotFoundException(`VehicleType ${id} not found`);
      }
      if (dto.name && dto.name !== existingType.name) {
        const byName = await this.repo.findByName(dto.name);
        if (byName && byName.id !== id) {
          return formatErrorResponse<VehicleType>(
            `Vehicle type name "${dto.name}" already exists`,
            'VEHICLE_TYPE_NAME_CONFLICT',
          );
        }
      }
      // 1. Actualizar categoría (si viene en el DTO)
      if(dto.categoryId){
        const category = await this.vehicleCategoryRepository.findById(
        dto.categoryId,
      );
      if (!category) {
        throw new NotFoundException(`Vehicle ${dto.categoryId} not found`);
      }
      existingType.category = category;
      }
      
      
      // 2. Actualizar clases de servicio (si vienen en el DTO)
      let serviceClasses: VehicleServiceClass[] = [];
      if (dto.serviceClassIds && dto.serviceClassIds.length > 0) {
        // Usamos el operador In para buscar todos los IDs de una vez
        serviceClasses = await queryRunner.manager.find(VehicleServiceClass, {
        where: { id: In(dto.serviceClassIds) },
    });


        // Verificamos si encontramos todas las clases de servicio
        if (serviceClasses.length !== dto.serviceClassIds.length) {
          const foundIds = serviceClasses.map((sc) => sc.id);
          const missingIds = dto.serviceClassIds.filter(
            (id) => !foundIds.includes(id),
          );
          throw new NotFoundException(
            `Vehicle service classes with IDs ${missingIds.join(', ')} not found`,
          );
        }
        // Reemplaza las clases de servicio existentes
        existingType.serviceClasses = serviceClasses;
      }
      // 3. Actualizar otros campos simples
      if (dto.name !== undefined) existingType.name = dto.name;
      if (dto.isActive !== undefined) existingType.isActive = dto.isActive;
      if (dto.defaultCapacity !== undefined) existingType.defaultCapacity = dto.defaultCapacity;
      if (dto.baseFare !== undefined) existingType.baseFare = dto.baseFare;
      if (dto.costPerKm !== undefined) existingType.costPerKm = dto.costPerKm;
      if (dto.costPerMinute !== undefined) existingType.costPerMinute = dto.costPerMinute;
      if (dto.minFare !== undefined) existingType.minFare = dto.minFare;
      if (dto.iconUrl !== undefined) existingType.iconUrl = dto.iconUrl;
      if (dto.description !== undefined) existingType.description = dto.description;
      
    const updated = await queryRunner.manager.save(VehicleType, existingType);  
    await queryRunner.commitTransaction();
    return formatSuccessResponse<VehicleType>(
        'Vehicle type updated successfully',
        updated,
      );
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();

      // Handle unique constraint violation
      if (error instanceof QueryFailedError) {
        const dbError = error.driverError as {
          code?: string;
          detail?: string;
        };
        if (
          dbError.code === '23505' &&
          dbError.detail?.includes('type_name')
        ) {
          this.logger.warn(
            `Name conflict on update: ${dto.name}`,
          );
          return formatErrorResponse<VehicleType>(
            'Vehicle type name conflict',
            'NAME_CONFLICT',
          );
        }
      }

      if (error instanceof NotFoundException) {
        return formatErrorResponse<VehicleType>(error.message, 'NOT_FOUND');
      }

      const err = error as Error;
      this.logger.error(`update failed for VehicleType ${id}`, err.stack);
      return formatErrorResponse<VehicleType>(
        'Failed to update vehicle type',
        err.name,
      );
    } finally {
      await queryRunner.release();
    }
  }
  async remove(id: string): Promise<ApiResponse<null>> {
    try {
      await this.repo.softDeleteProfile(id);
      return formatSuccessResponse<null>(
        'Vehicle type deleted successfully',
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
          'Database error deleting vehicle type',
          pgErr.code,
          pgErr.detail,
        );
      }

      // Cualquier otro error:
      return formatErrorResponse<null>(
        'Error deleting vehicle type',
        err instanceof Error ? err.message : 'DELETE_ERROR',
        err,
      );
    }
  }
}
