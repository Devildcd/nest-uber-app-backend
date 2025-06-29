import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { User, UserStatus } from '../entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { RegisterUserDto } from '../dto/register-user.dto';
import { AuthService } from 'src/modules/auth/services/auth.service';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import {
  formatErrorResponse,
  formatSuccessResponse,
  handleServiceError,
} from 'src/common/utils/api-response.utils';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { UserFiltersDto } from '../dto/user-filters.dto';
import { UserRepository } from '../repositories/user.repository';
import { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly credsService: AuthService,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Obtiene todos los usuarios con paginación y filtros.
   */
  async findAll(
    pagination: PaginationDto,
    filters?: UserFiltersDto,
  ): Promise<ApiResponse<User[]>> {
    try {
      const [users, total] = await this.userRepository.findAllPaginated(
        pagination,
        filters,
      );
      return formatSuccessResponse('Users retrieved successfully', users, {
        total,
        page: pagination.page ?? 1,
        limit: pagination.limit ?? 10,
      });
    } catch (error: any) {
      this.logger.error(
        'findAll failed',
        (error instanceof Error ? error.stack : undefined) ||
          (typeof error === 'object' && 'message' in error
            ? (error as { message: string }).message
            : String(error)),
      );
      // data opcional, aquí devolvemos array vacío
      const typedError = error as {
        code?: string;
        message?: string;
        stack?: string;
      };
      return {
        ...formatErrorResponse<User[]>(
          'Error fetching users',
          typedError.code,
          typedError,
        ),
        data: [],
      };
    }
  }

  /**
   * Obtiene un usuario por su ID.
   */
  async findById(id: string): Promise<ApiResponse<User>> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) {
        return formatErrorResponse('User not found', 'USER_NOT_FOUND');
      }
      return formatSuccessResponse('User retrieved successfully', user);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('findById failed', error.stack || error.message);
      } else {
        this.logger.error('findById failed', String(error));
      }
      // Tipar el error como { code?: string; message?: string; stack?: string }
      const typedError = error as {
        code?: string;
        message?: string;
        stack?: string;
      };
      return formatErrorResponse(
        'Error fetching user',
        typedError.code,
        typedError,
      );
    }
  }

  /**
   * Crea un nuevo usuario.
   * Si recibes un manager (transacción), lo usas; si no, usas el repo normal.
   *
   * @param dto datos del nuevo usuario
   * @param manager (opcional) EntityManager de la transacción
   * @returns el usuario recién creado
   */
  async create(
    dto: CreateUserDto,
    manager?: EntityManager,
  ): Promise<ApiResponse<User>> {
    const repo = (manager ?? this.dataSource.manager).getRepository(User);
    const email = dto.email.toLowerCase();

    const partial: Partial<User> = {
      ...dto,
      email,
      status: dto.status ?? UserStatus.ACTIVE,
      termsAcceptedAt: dto.termsAcceptedAt
        ? new Date(dto.termsAcceptedAt)
        : undefined,
      privacyPolicyAcceptedAt: dto.privacyPolicyAcceptedAt
        ? new Date(dto.privacyPolicyAcceptedAt)
        : undefined,
    };

    try {
      const user = repo.create(partial);
      const saved = await repo.save(user);
      this.logger.log(`User created: ${saved.id}`);
      return formatSuccessResponse('User created successfully', saved);
    } catch (err: any) {
      // caso de duplicado de email
      if (
        (err as { code?: string; detail?: string }).code === '23505' &&
        (err as { detail?: string }).detail?.includes('email')
      ) {
        this.logger.warn(`Duplicate email registration: ${email}`);
        return formatErrorResponse<User>(
          'Email is already registered',
          'EMAIL_CONFLICT',
        );
      }
      // cualquier otro error: fallback
      if (err instanceof Error) {
        this.logger.error('createUser failed', err.stack || err.message);
      } else {
        this.logger.error('createUser failed', String(err));
      }
      return formatErrorResponse<User>(
        'Failed to create user',
        'CREATE_USER_ERROR',
        err,
      );
    }
  }

  /**
   * Registra un usuario + credenciales en una sola transacción.
   */
  async register(dto: RegisterUserDto): Promise<ApiResponse<User>> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // 1) crear usuario
      const createResp = await this.create(dto.user, qr.manager);
      if (!createResp.success) {
        // si hubo un conflicto de email, lo retornamos directamente
        return createResp;
      }
      const user = createResp.data!;

      // 2) crear credenciales
      const credDto = { ...dto.credentials, userId: user.id };
      await this.credsService.createForUser(credDto, qr.manager);

      // 3) commit y respuesta
      await qr.commitTransaction();
      return formatSuccessResponse('User registered successfully', user);
    } catch (err: any) {
      await qr.rollbackTransaction();

      // si es conflicto ya tipificado en createUser, simplemente devolvemos ese error
      if (err instanceof ConflictException) {
        return formatErrorResponse<User>(
          err.message,
          err.getStatus().toString(),
        );
      }

      // para cualquier otro error, delegamos al manejador genérico
      handleServiceError(this.logger, err, 'register');
    } finally {
      await qr.release();
    }
    // Fallback return in case all other paths are bypassed
    return formatErrorResponse<User>(
      'Unexpected error during registration',
      'REGISTER_UNEXPECTED_ERROR',
    );
  }

  /**
   * Edita los campos permitidos de un usuario.
   */
  async update(id: string, dto: UpdateUserDto): Promise<ApiResponse<User>> {
    // Sólo estos campos pueden actualizarse
    const updateData: Partial<User> = {
      name: dto.name,
      phoneNumber: dto.phoneNumber,
      email: dto.email?.toLowerCase(),
    };

    try {
      const updated = await this.userRepository.updateUser(id, updateData);
      return formatSuccessResponse('User updated successfully', updated);
    } catch (err: any) {
      // 404 de repositorio
      if (err instanceof NotFoundException) {
        return formatErrorResponse<User>('User not found', 'USER_NOT_FOUND');
      }
      // duplicado de email
      if (
        (err as { code?: string; detail?: string }).code === '23505' &&
        (err as { detail?: string }).detail?.includes('email')
      ) {
        this.logger.warn(`Email conflict on update: ${dto.email}`);
        return formatErrorResponse<User>(
          'Email is already registered',
          'EMAIL_CONFLICT',
        );
      }
      // fallback genérico
      if (err instanceof Error) {
        this.logger.error(
          `update failed for user ${id}`,
          err.stack || err.message,
        );
      } else {
        this.logger.error(`update failed for user ${id}`, String(err));
      }
      return formatErrorResponse<User>(
        'Failed to update user',
        'UPDATE_USER_ERROR',
        err,
      );
    }
  }

  /**
   * Elimina (soft delete) un usuario.
   */
  async remove(id: string): Promise<ApiResponse<null>> {
    try {
      await this.userRepository.softDeleteUser(id);
      return formatSuccessResponse('User deleted successfully', null);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('remove failed', error.stack || error.message);
      } else {
        this.logger.error('remove failed', String(error));
      }
      const typedError = error as {
        code?: string;
        message?: string;
        stack?: string;
      };
      return formatErrorResponse(
        'Error deleting user',
        typedError.code,
        typedError,
      );
    }
  }
}
