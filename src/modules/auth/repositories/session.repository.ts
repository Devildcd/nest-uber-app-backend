import {
  Repository,
  DataSource,
  DeepPartial,
  SelectQueryBuilder,
} from 'typeorm';
import { Session, SessionType } from '../entities/session.entity';
import { Logger } from '@nestjs/common';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';

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

  /** Busca sesión por accessToken (útil para validar JWT) */
  async findByAccessToken(token: string): Promise<Session | null> {
    try {
      return this.findOne({
        where: { accessToken: token },
        relations: ['user'],
      });
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'findByAccessToken',
        this.entityName,
      );
    }
  }

  /** Verifica si existe un refreshToken dado */
  async existsByRefreshToken(token: string): Promise<boolean> {
    try {
      return this.createQueryBuilder('session')
        .select('1')
        .where('session.refreshToken = :token', { token })
        .getExists();
    } catch (err) {
      handleRepositoryError(
        this.logger,
        err,
        'existsByRefreshToken',
        this.entityName,
      );
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
