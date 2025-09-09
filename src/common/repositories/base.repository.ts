import { Logger } from '@nestjs/common';
import {
  EntityManager,
  EntityTarget,
  ObjectLiteral, // 👈 importa esto
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { handleRepositoryError } from '../utils/handle-repository-error';

export abstract class BaseRepository<
  T extends ObjectLiteral,
> extends Repository<T> {
  // 👈 restricción
  protected readonly logger: Logger;
  protected readonly entityName: string;

  constructor(
    entity: EntityTarget<T>,
    manager: EntityManager,
    repoName: string,
    entityName?: string,
  ) {
    super(entity, manager);
    this.logger = new Logger(repoName);
    this.entityName =
      entityName ??
      (typeof entity === 'function' ? (entity as any).name : String(entity));
  }

  /** Crea un QB tipado con alias */
  protected qb(alias: string): SelectQueryBuilder<T> {
    return this.createQueryBuilder(alias);
  }

  /** Aplica paginación “page/limit” */
  protected paginate(
    qb: SelectQueryBuilder<T>,
    page = 1,
    limit = 10,
  ): SelectQueryBuilder<T> {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    return qb.skip((safePage - 1) * safeLimit).take(safeLimit);
  }

  /** Safe wrapper de getManyAndCount con manejo de errores centralizado */
  protected async getManyAndCountSafe(
    qb: SelectQueryBuilder<T>,
    method: string,
  ): Promise<[T[], number]> {
    try {
      return await qb.getManyAndCount();
    } catch (err) {
      handleRepositoryError(this.logger, err, method, this.entityName);
      throw err; // 👈 garantiza que el tipo no “caiga” en undefined si tu helper no lanza
    }
  }

  /** getOne con manejo de errores centralizado */
  protected async getOneSafe(
    qb: SelectQueryBuilder<T>,
    method: string,
  ): Promise<T | null> {
    try {
      return await qb.getOne();
    } catch (err) {
      handleRepositoryError(this.logger, err, method, this.entityName);
      throw err; // 👈 idem
    }
  }

  /** Devuelve un repo “scoped” al manager si se provee (para transacciones) */
  protected scoped(manager?: EntityManager): Repository<T> {
    return manager
      ? manager.getRepository<T>(this.metadata.target as EntityTarget<T>)
      : this;
  }
}
