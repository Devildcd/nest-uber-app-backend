import { Logger } from '@nestjs/common';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import type { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';

// Modelo con dataSource.transaction
type TxWork<T> = (manager: EntityManager) => Promise<T>;

export interface TxOptions {
  isolation?: IsolationLevel; // 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE' ...
}

export async function runInTransaction<T>(
  dataSource: DataSource,
  work: TxWork<T>,
  opts: TxOptions = {},
): Promise<T> {
  const { isolation = 'READ COMMITTED' } = opts;
  return dataSource.transaction(isolation, async (manager) => {
    // Aquí puedes poner logging estándar, métricas, etc.
    return work(manager);
  });
}

// Modelo con queryRunner
type AfterCommit = () => Promise<void> | void;
type QrWork<T> = (
  qr: QueryRunner,
  manager: EntityManager,
  after: (cb: AfterCommit) => void,
) => Promise<T>;

export interface QrTxOptions {
  isolation?: IsolationLevel;
  logLabel?: string; // para logs consistentes
}

export async function withQueryRunnerTx<T>(
  dataSource: DataSource,
  work: QrWork<T>,
  opts: QrTxOptions = {},
): Promise<T> {
  const logger = new Logger('Tx');
  const { isolation = 'READ COMMITTED', logLabel = 'tx' } = opts;

  const qr = dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction(isolation);
  const after: AfterCommit[] = [];
  try {
    const result = await work(qr, qr.manager, (cb) => after.push(cb));
    await qr.commitTransaction();
    for (const cb of after) await cb();
    return result;
  } catch (err) {
    await qr.rollbackTransaction().catch(() => {});
    logger.error(
      `${logLabel} rollback`,
      err instanceof Error ? err.stack : String(err),
    );
    throw err; // que lo maneje tu ExceptionFilter global
  } finally {
    await qr.release();
  }
}
