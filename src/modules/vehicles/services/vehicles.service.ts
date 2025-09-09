import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryFailedError, QueryRunner } from 'typeorm';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import {
  formatErrorResponse,
  formatSuccessResponse,
  handleServiceError,
} from 'src/common/utils/api-response.utils';
import { PaginationDto } from 'src/common/dto/pagination.dto';

import { Vehicle } from '../entities/vehicle.entity';
import { VehicleRepository } from '../repositories/vehicle.repository';
import { VehicleTypeRepository } from '../../vehicle-types/repositories/vehicle-types.repository';
import { DriverProfile } from '../../driver-profiles/entities/driver-profile.entity';

import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../dto/update-vehicle.dto';
import { VehicleResponseDto } from '../dto/vehicle-response.dto';
import { VehicleListItemDto } from '../dto/vehicle-list-item.dto';
import { DriverProfileRepository } from 'src/modules/driver-profiles/repositories/driver-profile.repository';
import { VehicleFilterDto } from '../dto/vehicle-filter.dto';
import { UserRepository } from '../../user/repositories/user.repository';
import { VehicleListResponseDto } from '../dto/vehicle-list-item-response.dto';
@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    private readonly repo: VehicleRepository,
    private readonly vehicleTypeRepository: VehicleTypeRepository,
    private readonly driverProfileRepository: DriverProfileRepository,
    private readonly UserRepository: UserRepository,
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------
  // CREATE
  // ------------------------------
  async create(
    dto: CreateVehicleDto,
  ): Promise<ApiResponse<VehicleResponseDto>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Verificar tipo de vehículo
      const vehicleType = await this.vehicleTypeRepository.findById(
        dto.vehicleTypeId,
      );
      if (!vehicleType) {
        throw new NotFoundException(
          `VehicleType ${dto.vehicleTypeId} not found`,
        );
      }

      // Verificar driver
      const driver = await this.UserRepository.findById(dto.driverId);
      if (!driver) {
        throw new NotFoundException(`DriverId ${dto.driverId} not found`);
      }

      // Vaalidar driver profile
      const driverProfile = await queryRunner.manager.findOne(DriverProfile, {
        where: { id: dto.driverProfileId },
      });
      if (!driverProfile) {
        throw new NotFoundException(
          `DriverProfile ${dto.driverProfileId} not found`,
        );
      }
      if (dto.plateNumber) {
        const existingPlate = await this.repo.findByPlateNumber(
          dto.plateNumber,
          queryRunner.manager,
        );
        if (existingPlate) {
          return formatErrorResponse<VehicleResponseDto>(
            `Vehicle plate number "${dto.plateNumber}" already exists`,
            'PLATE_NUMBER_CONFLICT',
          );
        }
      }

      const partial: Partial<Vehicle> = {
        ...dto,
        vehicleType,
        driver,
        driverProfile,
      };

      const vehicle = await this.repo.createAndSave(
        partial,
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      const saved = await this.repo.findById(vehicle.id);
      if (!saved) {
        throw new NotFoundException('Vehicle not found after creation');
      }

      return formatSuccessResponse<VehicleResponseDto>(
        'Vehicle created successfully',
        this.toResponseDto(saved),
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
      return this.handleError(error, 'VehiclesService.create');
    } finally {
      await queryRunner.release();
    }
  }

  // ------------------------------
  // FIND ALL
  // ------------------------------
  async findAll(
    pagination: PaginationDto,
    filters?: VehicleFilterDto,
  ): Promise<ApiResponse<Vehicle[]>> {
    try {
      const [items, total] = await this.repo.findAllPaginated(
        pagination,
        filters,
      );
      //   const mapped = items.map((v) => this.toListItemDto(v));

      return formatSuccessResponse<Vehicle[]>(
        'Vehicles retrieved successfully',
        // mapped,
        items,
        { total, page: pagination.page ?? 1, limit: pagination.limit ?? 10 },
      );
    } catch (error: any) {
      this.logger.error('findAll failed', error.stack || error.message);
      return formatErrorResponse(
        'Error fetching vehicles',
        'FIND_ALL_ERROR',
        error,
      );
    }
  }

  // ------------------------------
  // FIND BY ID
  // ------------------------------
  async findById(id: string): Promise<ApiResponse<VehicleResponseDto>> {
    try {
      const vehicle = await this.repo.findById(id);
      if (!vehicle) {
        return formatErrorResponse('Vehicle not found', 'NOT_FOUND');
      }
      return formatSuccessResponse(
        'Vehicle retrieved successfully',
        this.toResponseDto(vehicle),
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

      return formatErrorResponse<VehicleResponseDto>(
        'Error fetching vehicle',
        typedError.code,
        typedError,
      );
    }
  }

  // ------------------------------
  // UPDATE
  // ------------------------------
  async update(
    id: string,
    dto: UpdateVehicleDto,
  ): Promise<ApiResponse<Vehicle>> {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(Vehicle, {
        where: { id },
        relations: ['vehicleType', 'driverProfile', 'driver'],
      });
      if (!existing) {
        throw new NotFoundException(`Vehicle ${id} not found`);
      }

      if (dto.vehicleTypeId) {
        const vehicleType = await this.vehicleTypeRepository.findById(
          dto.vehicleTypeId,
        );
        if (!vehicleType) {
          throw new NotFoundException(
            `VehicleType ${dto.vehicleTypeId} not found`,
          );
        }
        existing.vehicleType = vehicleType;
      }

      if (dto.driverProfileId) {
        const driverProfile = await queryRunner.manager.findOne(DriverProfile, {
          where: { id: dto.driverProfileId },
        });
        if (!driverProfile) {
          throw new NotFoundException(
            `DriverProfile ${dto.driverProfileId} not found`,
          );
        }
        existing.driverProfile = driverProfile;
      }
      // validar nuevo plateNumber (si se quiere actualizar)
      if (
        dto.plateNumber &&
        dto.plateNumber.trim().toUpperCase() !== existing.plateNumber
      ) {
        const conflict = await this.repo.findByPlateNumber(
          dto.plateNumber,
          queryRunner.manager,
        );
        if (conflict && conflict.id !== id) {
          return formatErrorResponse<Vehicle>(
            `Vehicle plate number "${dto.plateNumber}" already exists`,
            'PLATE_NUMBER_CONFLICT',
          );
        }
        existing.plateNumber = dto.plateNumber; // transformer se encargará de normalizar al guardar
      }
      if (dto.capacity !== undefined) existing.capacity = dto.capacity;
      if (dto.isActive !== undefined) existing.isActive = dto.isActive;
      if (dto.color !== undefined) existing.color = dto.color;
      if (dto.make !== undefined) existing.make = dto.make;
      if (dto.model !== undefined) existing.model = dto.model;
      if (dto.year !== undefined) existing.year = dto.year;
      if (dto.inspectionDate !== undefined)
        existing.inspectionDate = dto.inspectionDate;
      if (dto.lastMaintenanceDate !== undefined)
        existing.lastMaintenanceDate = dto.lastMaintenanceDate;
      if (dto.mileage !== undefined) existing.mileage = dto.mileage;
      if (dto.status !== undefined) existing.status = dto.status;

      const updated = await queryRunner.manager.save(Vehicle, existing);

      await queryRunner.commitTransaction();

      return formatSuccessResponse<Vehicle>(
        'Vehicle updated successfully',
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
          dbError.detail?.includes('plate_number')
        ) {
          this.logger.warn(
            `Platenumber conflict on update: ${dto.plateNumber}`,
          );
          return formatErrorResponse<Vehicle>(
            'Vehicle plate number conflict',
            'PLATE_NUMBER_CONFLICT',
          );
        }
      }

      if (error instanceof NotFoundException) {
        return formatErrorResponse<Vehicle>(error.message, 'NOT_FOUND');
      }

      const err = error as Error;
      this.logger.error(`update failed for Vehicle ${id}`, err.stack);
      return formatErrorResponse<Vehicle>('Failed to update vehicle', err.name);
    } finally {
      await queryRunner.release();
    }
  }

  // ------------------------------
  // REMOVE
  // ------------------------------
  async remove(id: string): Promise<ApiResponse<null>> {
    try {
      await this.repo.softDeleteVehicle(id);
      return formatSuccessResponse<null>('Vehicle deleted successfully', null);
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
          'Database error deleting vehicle',
          pgErr.code,
          pgErr.detail,
        );
      }

      // Cualquier otro error:
      return formatErrorResponse<null>(
        'Error deleting vehicle',
        err instanceof Error ? err.message : 'DELETE_ERROR',
        err,
      );
    }
  }
  // ------------------------------
  // Find Driver Profile By VehicleId
  // ------------------------------
  async findDriverProfileByVehicleId(
    vehicleId: string,
  ): Promise<ApiResponse<DriverProfile>> {
    try {
      const vehicle = await this.repo.findWithRelations(vehicleId, [
        'driverProfile',
      ]);
      if (!vehicle) {
        return formatErrorResponse('Vehicle not found', 'NOT_FOUND');
      }
      if (!vehicle.driverProfile) {
        return formatErrorResponse('Driver profile not found', 'NOT_FOUND');
      }

      return formatSuccessResponse<DriverProfile>(
        'Driver profile retrieved successfully',
        vehicle.driverProfile,
      );
    } catch (error: any) {
      this.logger.error(
        `findDriverProfileByVehicleId failed for ${vehicleId}`,
        error.stack || error.message,
      );
      return formatErrorResponse<DriverProfile>(
        'Error fetching driver profile',
        'FIND_DRIVER_PROFILE_ERROR',
        error,
      );
    }
  }

  // ------------------------------
  // PRIVATE HELPERS
  // ------------------------------
  private toResponseDto(vehicle: Vehicle): VehicleResponseDto {
    return {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color ? vehicle.color : undefined,
      capacity: vehicle.capacity,
      status: vehicle.status,
      plateNumber: vehicle.plateNumber,
      isActive: vehicle.isActive,
      driverId: vehicle.driver?.id ?? null,
      vehicleTypeId: vehicle.vehicleType?.id ?? null,
      driverProfileId: vehicle.driverProfile?.id ?? null,
      inspectionDate: vehicle.inspectionDate
        ? vehicle.inspectionDate.toISOString()
        : undefined,
      // Asumiendo que createdAt y updatedAt son de tipo Date
      lastMaintenanceDate: vehicle.lastMaintenanceDate
        ? vehicle.lastMaintenanceDate.toISOString()
        : undefined,
      mileage: vehicle.mileage ?? undefined,
      createdAt: vehicle.createdAt.toISOString(),
      updatedAt: vehicle.updatedAt.toISOString(),
    };
  }

  private toListItemDto(vehicle: Vehicle): VehicleListItemDto {
    return {
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      model: vehicle.model,
      color: vehicle.color,
      isActive: vehicle.isActive,
      status: vehicle.status,
      make: vehicle.make,
      year: vehicle.year,
      capacity: vehicle.capacity,
      driverId: vehicle.driver?.id ?? null,
      driverProfileId: vehicle.driverProfile?.id ?? null,
      vehicleTypeId: vehicle.vehicleType?.id ?? null,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    };
  }

  private handleError(error: any, context: string) {
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
    return handleServiceError(this.logger, error, context);
  }
}
