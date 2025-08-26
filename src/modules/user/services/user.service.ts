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

    // --- Normalización segura ---
    const emailRaw = dto.email ?? null;
    const phoneRaw = dto.phoneNumber ?? null;

    const email = emailRaw ? String(emailRaw).trim().toLowerCase() : null;
    // Normalize phone: quitar espacios y paréntesis, mantener + prefijo si existe
    const phone = phoneRaw
      ? String(phoneRaw)
          .replace(/[\s()-]/g, '')
          .trim()
      : null;

    // --- Validación rápida de negocio (defensa adicional) ---
    if (!email && !phone) {
      // Aunque class-validator debería haber atrapado esto, lo validamos defensivamente.
      return formatErrorResponse<User>(
        'Either email or phoneNumber must be provided',
        'MISSING_CONTACT',
      );
    }

    // --- Comprobar duplicados antes de intentar crear (mejor UX/errores claros) ---
    try {
      // Creamos condiciones de búsqueda dinámicas
      const whereConditions: any[] = [];
      if (email) whereConditions.push({ email });
      if (phone) whereConditions.push({ phoneNumber: phone });

      if (whereConditions.length > 0) {
        // findOne con array -> OR entre condiciones
        const existing = await repo.findOne({ where: whereConditions });
        if (existing) {
          // Detectar exactamente qué campo colisiona
          if (
            email &&
            existing.email &&
            existing.email.toLowerCase() === email
          ) {
            this.logger.warn(`Duplicate email registration attempt: ${email}`);
            return formatErrorResponse<User>(
              'Email is already registered',
              'EMAIL_CONFLICT',
            );
          }
          if (phone && existing.phoneNumber && existing.phoneNumber === phone) {
            this.logger.warn(`Duplicate phone registration attempt: ${phone}`);
            return formatErrorResponse<User>(
              'Phone number is already registered',
              'PHONE_CONFLICT',
            );
          }
          // fallback: conflicto genérico
          return formatErrorResponse<User>(
            'Credentials already exist',
            'CREDENTIALS_CONFLICT',
          );
        }
      }

      // --- Construir partial user sólo con campos definidos (no enviar undefined) ---
      const partial: Partial<User> = {
        name: dto.name,
        userType: dto.userType,
        status: dto.status ?? UserStatus.ACTIVE,
      };

      if (email) partial.email = email;
      if (phone) partial.phoneNumber = phone;

      if (dto.profilePictureUrl)
        partial.profilePictureUrl = dto.profilePictureUrl;
      if (dto.currentLocation)
        partial.currentLocation = dto.currentLocation as any;
      if (dto.vehicleId) {
        // Assuming vehicleId is a string or string[], and Vehicle is an entity with at least an 'id' property
        partial.vehicles = Array.isArray(dto.vehicleId)
          ? dto.vehicleId.map((id) => ({ id }) as any)
          : [{ id: dto.vehicleId } as any];
      }
      if (dto.preferredLanguage)
        partial.preferredLanguage = dto.preferredLanguage;
      if (dto.termsAcceptedAt)
        partial.termsAcceptedAt = new Date(dto.termsAcceptedAt);
      if (dto.privacyPolicyAcceptedAt)
        partial.privacyPolicyAcceptedAt = new Date(dto.privacyPolicyAcceptedAt);

      // Crear y guardar usando repo (si manager provisto, repo ya viene del manager)
      const user = repo.create(partial);
      const saved = await repo.save(user);

      this.logger.log(`User created: ${saved.id}`);
      return formatSuccessResponse('User created successfully', saved);
    } catch (err: any) {
      // Duplicate error by DB constraint (fallback a detectar 23505)
      if (
        (err as { code?: string; detail?: string }).code === '23505' &&
        (err as { detail?: string }).detail
      ) {
        const detail =
          typeof err === 'object' && err !== null && 'detail' in err
            ? (err as { detail: string }).detail
            : '';
        // mejorar mensajes según el campo en el detail
        if (detail.includes('email')) {
          this.logger.warn(`Duplicate email registration (DB): ${email}`);
          return formatErrorResponse<User>(
            'Email is already registered',
            'EMAIL_CONFLICT',
          );
        }
        if (
          detail.includes('phone') ||
          detail.includes('phone_number') ||
          detail.includes('phoneNumber')
        ) {
          this.logger.warn(`Duplicate phone registration (DB): ${phone}`);
          return formatErrorResponse<User>(
            'Phone number is already registered',
            'PHONE_CONFLICT',
          );
        }
        // fallback genérico para 23505
        return formatErrorResponse<User>(
          'Unique constraint violation',
          'UNIQUE_CONSTRAINT',
        );
      }

      // cualquier otro error: fallback genérico y log
      if (err instanceof Error) {
        this.logger.error('createUser failed', err.stack ?? err.message);
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
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const manager = qr.manager;
      const repo = manager.getRepository(User);

      // 1) lock fila del usuario para update (FOR UPDATE)
      const user = await manager
        .createQueryBuilder(User, 'u')
        .setLock('pessimistic_write')
        .where('u.id = :id', { id })
        .getOne();

      if (!user) {
        await qr.rollbackTransaction();
        return formatErrorResponse<User>('User not found', 'USER_NOT_FOUND');
      }

      // calcular nuevos valores
      const emailProvided = dto.email !== undefined;
      const phoneProvided = dto.phoneNumber !== undefined;

      const newEmail = emailProvided
        ? dto.email
          ? dto.email.trim().toLowerCase()
          : null
        : user.email;
      const newPhone = phoneProvided
        ? dto.phoneNumber
          ? dto.phoneNumber.replace(/[\s()-]/g, '').trim()
          : null
        : user.phoneNumber;

      if (!newEmail && !newPhone) {
        await qr.rollbackTransaction();
        return formatErrorResponse<User>(
          'Either email or phoneNumber must be present',
          'MISSING_CONTACT',
        );
      }

      // 2) check duplicados usando locks sobre rows candidatas
      if (newEmail && newEmail !== user.email) {
        const other = await manager
          .createQueryBuilder(User, 'u')
          .setLock('pessimistic_write')
          .where('u.email = :email', { email: newEmail })
          .getOne();
        if (other && other.id !== id) {
          await qr.rollbackTransaction();
          return formatErrorResponse<User>(
            'Email is already registered',
            'EMAIL_CONFLICT',
          );
        }
      }

      if (newPhone && newPhone !== user.phoneNumber) {
        const other = await manager
          .createQueryBuilder(User, 'u')
          .setLock('pessimistic_write')
          .where('u.phoneNumber = :phone', { phone: newPhone })
          .getOne();
        if (other && other.id !== id) {
          await qr.rollbackTransaction();
          return formatErrorResponse<User>(
            'Phone number is already registered',
            'PHONE_CONFLICT',
          );
        }
      }

      // 3) aplicar cambios y guardar
      if (dto.name !== undefined) user.name = dto.name;
      if (emailProvided) user.email = newEmail ?? undefined;
      if (phoneProvided) user.phoneNumber = newPhone ?? undefined;
      if (dto.userType !== undefined) user.userType = dto.userType;
      // ...otros cambios permitidos

      const saved = await repo.save(user);

      await qr.commitTransaction();
      return formatSuccessResponse('User updated successfully', saved);
    } catch (err: any) {
      await qr.rollbackTransaction();
      // manejar 23505 como fallback
      if (err?.code === '23505') {
        // inspeccionar detalle y mapear a EMAIL_CONFLICT / PHONE_CONFLICT
        return formatErrorResponse<User>(
          'Unique constraint violation',
          'UNIQUE_CONSTRAINT',
          err,
        );
      }
      this.logger.error('update failed', err);
      return formatErrorResponse<User>(
        'UPDATE_USER_ERROR',
        'UPDATE_USER_ERROR',
        err,
      );
    } finally {
      await qr.release();
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
