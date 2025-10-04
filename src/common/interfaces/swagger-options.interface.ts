import { Type } from '@nestjs/common';

export interface SwaggerOptions {
  title: string;
  /** Versión de la API */
  version: string;
  /** Ruta base donde se montará Swagger UI */
  path: string;
  /** Descripción opcional */
  description?: string;
  /** Módulos a incluir en esta sección */
  include?: Type<unknown>[];
  /** Variable de entorno para habilitar/deshabilitar esta sección */
  enabledEnvVar?: string;
}
