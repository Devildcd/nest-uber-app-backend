import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthCredentials } from '../entities/auth-credentials.entity';
import { AuthMethod } from '../entities/auth-credentials.entity';
import { CreateAuthCredentialsDto } from '../dto/create-auth-credentials.dto';
import { ConfigService } from '@nestjs/config';
import { User } from '../../user/entities/user.entity';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ApiResponse } from 'src/common/interfaces/api-response.interface';
import {
  formatErrorResponse,
  formatSuccessResponse,
  handleServiceError,
} from 'src/common/utils/api-response.utils';
import { AuthCredentialsRepository } from '../repositories/auth-credentials.repository';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly saltRounds: number;

  constructor(
    private readonly config: ConfigService,
    private readonly credsRepo: AuthCredentialsRepository,
  ) {
    this.saltRounds = this.config.get<number>('AUTH_SALT_ROUNDS', 12);
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
}
