import { EntityManager } from 'typeorm';

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
