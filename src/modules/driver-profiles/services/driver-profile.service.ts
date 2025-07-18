import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryFailedError, QueryRunner } from 'typeorm';
import { DriverProfileRepository } from '../repositories/driver-profile.repository';
import { CreateDriverProfileDto } from '../dto/create-driver-profile.dto';
import { UpdateDriverProfileDto } from '../dto/update-driver-profile.dto';
import { DriverProfileFiltersDto } from '../dto/driver-profile-filters.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import {
  formatErrorResponse,
  formatSuccessResponse,
  handleServiceError,
} from 'src/common/utils/api-response.utils';
import { DriverProfile } from '../entities/driver-profile.entity';
import { UserRepository } from 'src/modules/user/repositories/user.repository';
import { DriverProfileResponseDto } from '../dto/driver-profile-response.dto';

@Injectable()
export class DriverProfileService {
  private readonly logger = new Logger(DriverProfileService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly repo: DriverProfileRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async findAll(
    pagination: PaginationDto,
    filters?: DriverProfileFiltersDto,
  ): Promise<ApiResponse<DriverProfile[]>> {
    try {
      const [items, total] = await this.repo.findAllPaginated(
        pagination,
        filters,
      );
      return formatSuccessResponse<DriverProfile[]>(
        'Driver profiles retrieved successfully',
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
        ...formatErrorResponse<DriverProfile[]>(
          'Error fetching driver profiles',
          typedError.code,
          typedError,
        ),
        data: [],
      };
    }
  }

  async findById(id: string): Promise<ApiResponse<DriverProfile>> {
    try {
      const profile = await this.repo.findById(id);
      if (!profile) {
        return formatErrorResponse<DriverProfile>(
          'Driver profile not found',
          'NOT_FOUND',
        );
      }
      return formatSuccessResponse<DriverProfile>(
        'Driver profile retrieved successfully',
        profile,
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

      return formatErrorResponse<DriverProfile>(
        'Error fetching driver profile',
        typedError.code,
        typedError,
      );
    }
  }

  async create(
    dto: CreateDriverProfileDto,
  ): Promise<ApiResponse<DriverProfileResponseDto>> {
    const qr: QueryRunner = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // verificamos existencia de usuario
      const user = await this.userRepository.findOne({
        where: { id: dto.userId },
      });
      if (!user) {
        throw new NotFoundException(`User ${dto.userId} no existe`);
      }

      // destructuramos fechas + el resto
      const {
        userId,
        driverLicenseExpirationDate,
        backgroundCheckDate,
        lastOnlineAt,
        ...rest
      } = dto;

      // payload con spread + conversión de fechas
      const partial = {
        user: { id: userId },
        ...rest,
        driverLicenseExpirationDate: new Date(driverLicenseExpirationDate),
        ...(backgroundCheckDate && {
          backgroundCheckDate: new Date(backgroundCheckDate),
        }),
        ...(lastOnlineAt && { lastOnlineAt: new Date(lastOnlineAt) }),
      };

      // creamos el perfil
      const profile = await this.repo.createAndSave(partial, qr.manager);

      await qr.commitTransaction();

      // mapear a DTO de salida
      const data: DriverProfileResponseDto = {
        id: profile.id,
        userId: profile.user.id,
        driverLicenseNumber: profile.driverLicenseNumber,
        driverLicenseExpirationDate:
          profile.driverLicenseExpirationDate.toISOString(),
        driverLicensePictureUrl: profile.driverLicensePictureUrl,
        backgroundCheckStatus: profile.backgroundCheckStatus,
        backgroundCheckDate: profile.backgroundCheckDate?.toISOString(),
        isApproved: profile.isApproved,
        onboardingStatus: profile.onboardingStatus,
        emergencyContactInfo: profile.emergencyContactInfo,
        lastOnlineAt: profile.lastOnlineAt?.toISOString(),
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      };

      return {
        success: true,
        message: 'Driver profile created successfully',
        data,
      };
    } catch (err: any) {
      // siempre rollback si hay error
      await qr.rollbackTransaction();

      // 1. Manejo de errores de QueryFailedError (DB)
      if (err instanceof QueryFailedError) {
        // err.driverError viene tipado según el driver de BD (en Postgres: { code, detail, ... })
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

      // para cualquier otro error, delegamos al handler genérico
      return handleServiceError<DriverProfileResponseDto>(
        this.logger,
        err,
        'DriversService.create',
      );
    } finally {
      await qr.release();
    }
  }

  /**
   * Updates a driver's profile by ID within a transaction.
   * @param id - UUID of the DriverProfile
   * @param dto - Partial DTO containing updatable fields
   * @returns ApiResponse containing updated DriverProfile or error info
   */
  async update(
    id: string,
    dto: UpdateDriverProfileDto,
  ): Promise<ApiResponse<DriverProfile>> {
    const queryRunner: QueryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(DriverProfile, {
        where: { id },
      });
      if (!existing) {
        throw new NotFoundException(`DriverProfile ${id} not found`);
      }

      const updates: Partial<DriverProfile> = {};
      if (dto.driverLicenseNumber !== undefined)
        updates.driverLicenseNumber = dto.driverLicenseNumber;
      if (dto.driverLicenseExpirationDate !== undefined)
        updates.driverLicenseExpirationDate = new Date(
          dto.driverLicenseExpirationDate,
        );
      if (dto.driverLicensePictureUrl !== undefined)
        updates.driverLicensePictureUrl = dto.driverLicensePictureUrl;
      if (dto.emergencyContactInfo !== undefined)
        updates.emergencyContactInfo = dto.emergencyContactInfo;

      const updated = await queryRunner.manager.save(DriverProfile, {
        ...existing,
        ...updates,
      });
      await queryRunner.commitTransaction();

      return formatSuccessResponse<DriverProfile>(
        'Driver profile updated successfully',
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
          dbError.detail?.includes('driver_license_number')
        ) {
          this.logger.warn(
            `License conflict on update: ${dto.driverLicenseNumber}`,
          );
          return formatErrorResponse<DriverProfile>(
            'Driver license number conflict',
            'LICENSE_CONFLICT',
          );
        }
      }

      if (error instanceof NotFoundException) {
        return formatErrorResponse<DriverProfile>(error.message, 'NOT_FOUND');
      }

      const err = error as Error;
      this.logger.error(`update failed for DriverProfile ${id}`, err.stack);
      return formatErrorResponse<DriverProfile>(
        'Failed to update driver profile',
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
        'Driver profile deleted successfully',
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
          'Database error deleting driver profile',
          pgErr.code,
          pgErr.detail,
        );
      }

      // Cualquier otro error:
      return formatErrorResponse<null>(
        'Error deleting driver profile',
        err instanceof Error ? err.message : 'DELETE_ERROR',
        err,
      );
    }
  }
}
