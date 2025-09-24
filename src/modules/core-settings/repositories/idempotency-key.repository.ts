import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource, DeepPartial, EntityManager } from 'typeorm';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { handleRepositoryError } from 'src/common/utils/handle-repository-error';
import { IdempotencyKey, IdemStatus } from '../entities/idempotency-key.entity';

type ClaimProceed = { decision: 'proceed'; row: IdempotencyKey };
type ClaimStoredSuccess = {
  decision: 'returnStoredSuccess';
  responseCode: number;
  responseBody: any;
  headers?: any;
};
type ClaimInProgress = { decision: 'inProgress'; retryAfterSec: number };
type ClaimStoredFailure = {
  decision: 'returnStoredFailure';
  errorCode?: string;
  details?: any;
};

export interface ClaimParams {
  key: string;
  method: string; // 'POST' | 'PUT' | ...
  endpoint: string; // ruta canónica (p.ej. 'POST /trips' o 'trips:create')
  userId?: string | null;
  tenantId?: string | null;
  requestHash?: string | null; // SHA-256 del body normalizado (opcional)
  leaseSeconds?: number; // default 30
  windowSeconds?: number; // default 86400 (24h)
  manager?: EntityManager;
}

@Injectable()
export class IdempotencyKeyRepository extends BaseRepository<IdempotencyKey> {
  constructor(ds: DataSource) {
    super(
      IdempotencyKey,
      ds.createEntityManager(),
      'IdempotencyKeyRepository',
      'IdempotencyKey',
    );
  }

  /**
   * Reclama la key o devuelve la respuesta/cache existente.
   * Flujo:
   * 1) Intentar INSERT (status=in_progress, lease). Si entra ⇒ proceed.
   * 2) Si existe:
   *   - status=succeeded ⇒ devolver respuesta cacheada
   *   - status=in_progress con lease vigente ⇒ inProgress (409/202 en capa superior)
   *   - status=in_progress con lease vencido ⇒ “robar” el lock y proceed
   *   - status=failed ⇒ según política: devolver falla cacheada (aquí la devolvemos)
   *   - requestHash distinto (si lo usas) ⇒ devolvemos failure semántica
   */
  async claimOrGet(params: {
    key: string;
    method: string;
    endpoint: string;
    userId?: string | null;
    tenantId?: string | null;
    requestHash?: string | null;
    leaseSeconds?: number; // default 30
    windowSeconds?: number; // default 86400
    manager?: EntityManager;
  }): Promise<
    | { decision: 'proceed'; row: IdempotencyKey }
    | {
        decision: 'returnStoredSuccess';
        responseCode: number;
        responseBody: any;
        headers?: any;
      }
    | { decision: 'inProgress'; retryAfterSec: number }
    | { decision: 'returnStoredFailure'; errorCode?: string; details?: any }
  > {
    const {
      key,
      method,
      endpoint,
      userId = null,
      tenantId = null,
      requestHash = null,
      leaseSeconds = 30,
      windowSeconds = 86400,
      manager,
    } = params;

    const repo = (
      manager ? manager.getRepository(IdempotencyKey) : (this as any)
    ) /* si extiendes BaseRepository, usa this */ as import('typeorm').Repository<IdempotencyKey>;

    const now = new Date();
    const lockedUntil = new Date(now.getTime() + leaseSeconds * 1000);
    const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

    // 1) Buscar existente por (key, method, endpoint)
    let row = await repo.findOne({
      where: { key, method, endpoint } as any,
      lock: undefined,
    });

    if (row) {
      // Touch de última solicitud
      await repo.update({ id: row.id } as any, { lastRequestAt: now } as any);

      // Dentro de ventana de idempotencia
      const stillValid =
        !row.expiresAt || row.expiresAt.getTime() > now.getTime();

      // a) Ya finalizado con éxito → devolver la respuesta almacenada
      if (row.status === IdemStatus.SUCCEEDED && stillValid) {
        return {
          decision: 'returnStoredSuccess',
          responseCode: row.responseCode ?? 200,
          responseBody: row.responseBody ?? null,
          headers: row.responseHeaders ?? undefined,
        };
      }

      // b) Fallo cacheado y dentro de ventana
      if (row.status === IdemStatus.FAILED && stillValid) {
        return {
          decision: 'returnStoredFailure',
          errorCode: row.errorCode ?? undefined,
          details: row.errorDetails ?? undefined,
        };
      }

      // c) En progreso con lease vigente → informar retry
      if (
        row.status === IdemStatus.IN_PROGRESS &&
        row.lockedUntil &&
        row.lockedUntil.getTime() > now.getTime()
      ) {
        const retryAfterSec = Math.max(
          1,
          Math.ceil((row.lockedUntil.getTime() - now.getTime()) / 1000),
        );
        return { decision: 'inProgress', retryAfterSec };
      }

      // d) Lease vencido o ventana expirada → renovar/reciclar el candado
      const patch: DeepPartial<IdempotencyKey> = {
        status: IdemStatus.IN_PROGRESS,
        lockedAt: now,
        lockedUntil,
        attemptCount: (row.attemptCount ?? 0) + 1,
        // re-abrimos ventana (opcional; si no quieres, comenta la línea)
        expiresAt,
      };
      await repo.update({ id: row.id } as any, patch as any);

      // devolvemos el row actualizado (con datos frescos claves del candado)
      row = { ...row, ...patch } as IdempotencyKey;
      return { decision: 'proceed', row };
    }

    // 2) No existe → crear NUEVO candado IN_PROGRESS
    const toInsert: DeepPartial<IdempotencyKey> = {
      key,
      method,
      endpoint,
      userId,
      tenantId,
      requestHash,
      status: IdemStatus.IN_PROGRESS,
      lockedAt: now,
      lockedUntil,
      attemptCount: 1,
      firstRequestAt: now,
      lastRequestAt: now,
      idempotencyWindowSec: windowSeconds,
      expiresAt,
    };

    // 👇 Forzamos el overload de objeto
    const fresh = repo.create(toInsert);
    try {
      const saved = await repo.save(fresh); // saved ya trae id
      return { decision: 'proceed', row: saved };
    } catch (err: any) {
      // carrera: otro proceso insertó primero ⇒ leer y aplicar misma lógica de arriba
      // (unique constraint en key+method+endpoint)
      if (err?.code === '23505') {
        const existing = await repo.findOne({
          where: { key, method, endpoint } as any,
        });
        if (!existing) {
          // debería existir; si no, reintenta simple
          throw err;
        }
        // Re-entra por la rama de existente
        // (puedes factorizar este bloque en una función para no duplicar)
        const stillValid =
          !existing.expiresAt || existing.expiresAt.getTime() > now.getTime();

        if (existing.status === IdemStatus.SUCCEEDED && stillValid) {
          return {
            decision: 'returnStoredSuccess',
            responseCode: existing.responseCode ?? 200,
            responseBody: existing.responseBody ?? null,
            headers: existing.responseHeaders ?? undefined,
          };
        }
        if (existing.status === IdemStatus.FAILED && stillValid) {
          return {
            decision: 'returnStoredFailure',
            errorCode: existing.errorCode ?? undefined,
            details: existing.errorDetails ?? undefined,
          };
        }
        if (
          existing.status === IdemStatus.IN_PROGRESS &&
          existing.lockedUntil &&
          existing.lockedUntil.getTime() > now.getTime()
        ) {
          const retryAfterSec = Math.max(
            1,
            Math.ceil((existing.lockedUntil.getTime() - now.getTime()) / 1000),
          );
          return { decision: 'inProgress', retryAfterSec };
        }

        // renovar lease si está vencido
        const patch: DeepPartial<IdempotencyKey> = {
          status: IdemStatus.IN_PROGRESS,
          lockedAt: now,
          lockedUntil,
          attemptCount: (existing.attemptCount ?? 0) + 1,
          expiresAt,
        };
        await repo.update({ id: existing.id } as any, patch as any);
        return {
          decision: 'proceed',
          row: { ...existing, ...patch } as IdempotencyKey,
        };
      }
      throw err;
    }
  }

  // succeed/fail/cleanup… (sin cambios relevantes al tema del overload)
  async succeed(
    key: string,
    responseCode: number,
    body: any,
    headers?: any,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = (
      manager ? manager.getRepository(IdempotencyKey) : (this as any)
    ) as import('typeorm').Repository<IdempotencyKey>;
    await repo.update(
      { key } as any,
      {
        status: IdemStatus.SUCCEEDED,
        responseCode,
        responseBody: body ?? null,
        responseHeaders: headers ?? null,
        lockedUntil: null,
      } as any,
    );
  }

  async fail(
    key: string,
    errorCode?: string,
    details?: any,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = (
      manager ? manager.getRepository(IdempotencyKey) : (this as any)
    ) as import('typeorm').Repository<IdempotencyKey>;
    await repo.update(
      { key } as any,
      {
        status: IdemStatus.FAILED,
        errorCode: errorCode ?? null,
        errorDetails: details ?? null,
        lockedUntil: null,
      } as any,
    );
  }

  async cleanupExpired(
    now = new Date(),
    manager?: EntityManager,
  ): Promise<number> {
    const repo = (
      manager ? manager.getRepository(IdempotencyKey) : (this as any)
    ) as import('typeorm').Repository<IdempotencyKey>;
    const res = await repo
      .createQueryBuilder()
      .delete()
      .from(IdempotencyKey)
      .where('expires_at IS NOT NULL AND expires_at < :now', { now })
      .execute();
    return res.affected ?? 0;
  }

  // ----------------- Helpers privados -----------------

  /** Recorta/copia segura del body (evita payloads gigantes). */
  private truncateBody(body: any, maxBytes = 64_000): any {
    try {
      const buf = Buffer.from(JSON.stringify(body ?? null), 'utf8');
      if (buf.byteLength <= maxBytes) return body;
      // recorta: guarda sólo un aviso + primeros N bytes como string
      return {
        __truncated__: true,
        preview: buf.toString('utf8', 0, maxBytes),
        original_size: buf.byteLength,
      };
    } catch {
      return body ?? null;
    }
  }

  /** Redacta headers y recorta tamaño total. */
  private truncateHeaders(headers: any, maxBytes = 16_000): any {
    if (!headers) return undefined;
    const safe = { ...headers };
    // Redacta campos sensibles si existen
    for (const k of Object.keys(safe)) {
      if (/(authorization|cookie|token|secret|key)/i.test(k)) {
        safe[k] = '__redacted__';
      }
    }
    return this.truncateBody(safe, maxBytes);
  }
}
