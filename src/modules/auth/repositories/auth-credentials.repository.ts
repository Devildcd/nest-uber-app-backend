import { Injectable, Logger } from '@nestjs/common';
import { DataSource, DeleteResult, Repository, UpdateResult } from 'typeorm';
import { AuthCredentials } from '../entities/auth-credentials.entity';
import { AuthMethod } from '../entities/auth-credentials.entity';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';

@Injectable()
export class AuthCredentialsRepository extends Repository<AuthCredentials> {
  private readonly logger = new Logger(AuthCredentialsRepository.name);
  private readonly entityName = 'AuthCredentials';

  constructor(private readonly dataSource: DataSource) {
    super(AuthCredentials, dataSource.createEntityManager());
  }

  /**
   * Crea un nuevo registro de credenciales y le aplica
   * valores por defecto (timestamps, flags, etc.).
   */
  async createCredentials(
    partial: Partial<AuthCredentials>,
  ): Promise<AuthCredentials> {
    const toSave = this.create({
      ...partial,
      authenticationMethod: partial.authenticationMethod ?? AuthMethod.LOCAL,
      failedLoginAttempts: 0,
      mfaEnabled: false,
    });

    return this.save(toSave);
  }

  /**
   * Actualiza el hash y salt de la contraseña para un user dado.
   */
  async updatePassword(
    userId: string,
    passwordHash: string,
    salt: string,
  ): Promise<void> {
    try {
      await this.createQueryBuilder()
        .update(AuthCredentials)
        .set({
          passwordHash,
          salt,
          lastPasswordChangeAt: () => 'CURRENT_TIMESTAMP',
        })
        .where('user_id = :userId', { userId })
        .execute();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'updatePassword',
        this.entityName,
      );
    }
  }

  /**
   * Busca credenciales por el UUID del usuario
   */
  async findByUserId(userId: string): Promise<AuthCredentials | null> {
    return this.findOne({ where: { user: { id: userId } } });
  }

  /**
   * Incrementa el contador de intentos fallidos y, opcionalmente, bloquea la cuenta
   */
  async incrementFailedLogin(
    userId: string,
    lockoutThreshold: number,
    lockoutDurationMs: number,
  ): Promise<UpdateResult> {
    const qb = this.createQueryBuilder()
      .update()
      .set({ failedLoginAttempts: () => '"failedLoginAttempts" + 1' })
      .where('user_id = :userId', { userId });

    const result = await qb.execute();

    // Si superó el umbral, setear lockoutUntil
    const cred = await this.findByUserId(userId);
    if (cred && cred.failedLoginAttempts + 1 >= lockoutThreshold) {
      const until = new Date(Date.now() + lockoutDurationMs);
      await this.update({ id: cred.id }, { lockoutUntil: until });
    }

    return result;
  }

  /**
   * Resetea el contador de intentos fallidos y desbloquea la cuenta
   */
  async resetFailedLogins(userId: string): Promise<UpdateResult> {
    return this.createQueryBuilder()
      .update()
      .set({ failedLoginAttempts: 0, lockoutUntil: undefined })
      .where('user_id = :userId', { userId })
      .execute();
  }

  /**
   * Borra un registro por su ID
   */
  async removeById(id: string): Promise<DeleteResult> {
    return this.delete({ id });
  }
}
