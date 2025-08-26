import {
  Repository,
  DataSource,
  DeepPartial,
  SelectQueryBuilder,
} from 'typeorm';
import { Session, SessionType } from '../entities/session.entity';
import { Logger } from '@nestjs/common';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import argon2 from 'argon2';

export class SessionRepository extends Repository<Session> {
  private readonly logger = new Logger(SessionRepository.name);
  private readonly entityName = 'Session';

  constructor(dataSource: DataSource) {
    super(Session, dataSource?.createEntityManager());
  }

  /** Crea y guarda una nueva sesión */
  async createAndSave(sessionLike: DeepPartial<Session>): Promise<Session> {
    const session = this.create(sessionLike);
    try {
      return await this.save(session);
    } catch (err) {
      handleRepositoryError(this.logger, err, 'createAndSave', this.entityName);
    }
  }

  /** Busca sesión por jti (session id) — reemplaza findByAccessToken */
  async findByJti(jti: string): Promise<Session | null> {
    try {
      return this.findOne({
        where: { jti },
        relations: ['user'],
      });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'findByJti', this.entityName);
    }
  }

  /**
   * Verifica si el refreshToken dado corresponde a la sesión con ese jti.
   * - no hace escaneo de tabla
   * - devuelve false si no existe session o hash mismatch
   */
  async existsByJtiAndRefreshToken(
    jti: string,
    refreshToken: string,
  ): Promise<boolean> {
    try {
      const session = await this.findOne({ where: { jti } });
      if (!session) return false;
      // session.refreshTokenHash debe existir
      if (!session.refreshTokenHash) return false;
      try {
        return await argon2.verify(session.refreshTokenHash, refreshToken);
      } catch {
        // verify lanza en algunos casos; tratamos como mismatch
        return false;
      }
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'existsByJtiAndRefreshToken',
        this.entityName,
      );
    }
    return false;
  }

  /**
   * Helper: marca sesión como revocada (útil cuando detectas reuse/tampering)
   */
  async revokeByJti(jti: string): Promise<void> {
    try {
      await this.update({ jti }, { revoked: true, lastActivityAt: new Date() });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'revokeByJti', this.entityName);
    }
  }

  /** Actualiza la última actividad de una sesión */
  async touch(sessionId: string): Promise<void> {
    try {
      await this.update(sessionId, {
        lastActivityAt: () => 'CURRENT_TIMESTAMP',
      });
    } catch (err) {
      handleRepositoryError(this.logger, err, 'touch', this.entityName);
    }
  }

  /** Marca MFA como verificado */
  async markMfaVerified(sessionId: string): Promise<void> {
    try {
      await this.update(sessionId, { mfaVerified: true });
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'markMfaVerified',
        this.entityName,
      );
    }
  }

  /** Invalida (borra) todas las sesiones de un usuario */
  async invalidateAllByUser(userId: string): Promise<void> {
    try {
      await this.createQueryBuilder()
        .delete()
        .where('userId = :userId', { userId })
        .execute();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'invalidateAllByUser',
        this.entityName,
      );
    }
  }

  /** Listado paginado de sesiones (con filtros opcionales por tipo o usuario) */
  async findAllPaginated(
    page: number = 1,
    limit: number = 10,
    sessionType?: SessionType,
    userId?: string,
  ): Promise<[Session[], number]> {
    try {
      const skip = (page - 1) * limit;
      let qb: SelectQueryBuilder<Session> = this.createQueryBuilder('session')
        .leftJoinAndSelect('session.user', 'user')
        .orderBy('session.lastActivityAt', 'DESC')
        .skip(skip)
        .take(limit);

      if (sessionType) {
        qb = qb.andWhere('session.sessionType = :type', { type: sessionType });
      }
      if (userId) {
        qb = qb.andWhere('user.id = :userId', { userId });
      }

      return qb.getManyAndCount();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findAllPaginated',
        this.entityName,
      );
    }
  }
}
