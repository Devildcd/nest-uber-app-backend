import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { User, UserStatus } from '../entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { RegisterUserDto } from '../dto/register-user.dto';
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
import {
  AuthCredentials,
  AuthMethod,
} from 'src/modules/user/entities/auth-credentials.entity';
import * as bcrypt from 'bcrypt';
import { CreateAuthCredentialsDto } from '../dto/create-auth-credentials.dto';
import { ConfigService } from '@nestjs/config';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { AuthCredentialsRepository } from '../repositories/auth-credentials.repository';
import { UserProfileDto } from '../dto/user-profile.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly saltRounds: number;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly userRepository: UserRepository,
    private readonly credsRepo: AuthCredentialsRepository,
  ) {
    this.saltRounds = this.config.get<number>('AUTH_SALT_ROUNDS', 12);
  }

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
   * Devuelve los datos públicos del usuario autenticado, envuelto en ApiResponse.
   */
  async getProfile(
    userId: string,
  ): Promise<ApiResponse<UserProfileDto | null>> {
    try {
      const user = await this.userRepository.findById(userId);

      if (!user) {
        throw new NotFoundException(`User with id ${userId} not found`);
      }

      const dto = plainToInstance(UserProfileDto, user, {
        excludeExtraneousValues: true,
      });

      return formatSuccessResponse('Profile obtained correctly', dto);
    } catch (err) {
      return handleServiceError(this.logger, err, 'UserService.getProfile');
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
   * Crea credenciales para un usuario según DTO.
   * Usa el EntityManager de la transacción.
   */
  async createForUser(
    dto: CreateAuthCredentialsDto,
    manager: EntityManager,
  ): Promise<ApiResponse<AuthCredentials | null>> {
    try {
      const userId = dto.userId!;

      // 1) Validar usuario existente
      const userExists = await manager.exists(User, { where: { id: userId } });
      if (!userExists) {
        throw new Error('User not found');
      }

      // 2) Evitar duplicados
      const existing = await manager.findOne(AuthCredentials, {
        where: { user: { id: userId } },
      });
      if (existing) {
        throw new Error('Credentials already exist for user');
      }

      // 3) Mapear DTO → entidad parcial
      const { password, ...rawDto } = dto;
      const restDto: Partial<AuthCredentials> = {};
      for (const [key, val] of Object.entries(rawDto)) {
        if (val != null) {
          restDto[key] =
            key.toLowerCase().endsWith('at') && typeof val === 'string'
              ? new Date(val)
              : val;
        }
      }

      // 4) Hashear contraseña local
      if (dto.authenticationMethod === AuthMethod.LOCAL && password) {
        const salt = await bcrypt.genSalt(this.saltRounds);
        restDto.salt = salt;
        restDto.passwordHash = await bcrypt.hash(password, salt);
      }

      // 5) Persistir
      const credsRepo = manager.getRepository(AuthCredentials);
      const newCreds = credsRepo.create({
        user: { id: userId },
        ...restDto,
      });
      const saved = await credsRepo.save(newCreds);

      this.logger.log(
        `Credentials created for user: ${userId}, credsId: ${saved.id}`,
      );
      return formatSuccessResponse('Credentials created successfully', saved);
    } catch (err) {
      // Manejo unificado de errores → devuelve ApiResponse<null> con el código adecuado
      return handleServiceError(this.logger, err, 'createForUser');
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
      await this.createForUser(credDto, qr.manager);

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
   * Cambia la contraseña de un usuario (inserta un nuevo hash+salt).
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<ApiResponse<null>> {
    try {
      // 1) Generar salt y hash
      const salt = await bcrypt.genSalt();
      const hash = await bcrypt.hash(dto.newPassword, salt);

      // 2) Ejecutar update en el repo
      await this.credsRepo.updatePassword(userId, hash, salt);

      // 3) Responder éxito
      return formatSuccessResponse('Password updated successfully', null);
    } catch (err: any) {
      // Log y error estandarizado
      if (err instanceof Error) {
        this.logger.error(
          `changePassword failed for user ${userId}`,
          err.stack || err.message,
        );
      } else {
        this.logger.error(
          `changePassword failed for user ${userId}`,
          String(err),
        );
      }
      return formatErrorResponse<null>(
        'Failed to update password',
        'PASSWORD_UPDATE_ERROR',
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

  /**
   * Valida email|phone + password, carga user + authCredentials y
   * compara contra bcrypt. Retorna el User sin la contraseña si ok,
   * o null si credenciales inválidas.
   */
  async validateUserCredentials(
    dto: { email?: string; phoneNumber?: string; password: string },
    manager: EntityManager,
  ): Promise<User | null> {
    const repo = manager.getRepository(User);

    // 1) Carga el usuario con sus AuthCredentials
    const user = await repo.findOne({
      where: dto.email
        ? { email: dto.email.toLowerCase() }
        : { phoneNumber: dto.phoneNumber! },
      relations: ['authCredentials'],
    });

    if (
      !user ||
      !user.authCredentials ||
      user.authCredentials.authenticationMethod !== AuthMethod.LOCAL ||
      !user.authCredentials.passwordHash ||
      !user.authCredentials.salt
    ) {
      // no existe o no es login local
      return null;
    }

    // 2) Comprueba lockout por intentos fallidos
    const now = new Date();
    if (
      user.authCredentials.lockoutUntil &&
      user.authCredentials.lockoutUntil > now
    ) {
      this.logger.warn(
        `User ${user.id} está bloqueado hasta ${user.authCredentials.lockoutUntil?.toISOString()}`,
      );
      throw new UnauthorizedException('Account is temporarily locked');
    }

    // 3) Hashea la contraseña recibida con la sal guardada
    const hash = await bcrypt.hash(dto.password, user.authCredentials.salt);
    const isMatch = hash === user.authCredentials.passwordHash;

    if (!isMatch) {
      // 4) Incrementa intentos fallidos y setea lockout si excede
      const credsRepo = manager.getRepository(AuthCredentials);
      user.authCredentials.failedLoginAttempts++;
      if (user.authCredentials.failedLoginAttempts >= 5) {
        // bloquea 15 minutos, por ejemplo
        user.authCredentials.lockoutUntil = new Date(Date.now() + 15 * 60_000);
        this.logger.warn(`User ${user.id} bloqueado por varios fallos`);
      }
      await credsRepo.save(user.authCredentials);
      return null;
    }

    // 5) Si es match, resetea intentos fallidos
    if (user.authCredentials.failedLoginAttempts > 0) {
      user.authCredentials.failedLoginAttempts = 0;
      user.authCredentials.lockoutUntil = undefined;
      await manager.getRepository(AuthCredentials).save(user.authCredentials);
    }

    // 6) Verifica que el usuario esté activo
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User is not active');
    }

    // 7) Todo OK → retornamos el user (sin exponer passwordHash)
    delete user.authCredentials.passwordHash;
    if (user.authCredentials) {
      delete user.authCredentials.salt;
    }
    return user;
  }
}
