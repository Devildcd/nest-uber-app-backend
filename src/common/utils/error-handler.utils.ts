import {
  Logger,
  InternalServerErrorException,
  ConflictException,
  HttpException,
} from '@nestjs/common';

/**
 * Maneja errores de repositorio de forma consistente
 * @param logger Instancia del logger
 * @param error Error capturado
 * @param context Contexto del error (nombre del método o operación)
 * @param entityName (Opcional) Nombre de la entidad
 */
export function handleRepositoryError(
  logger: Logger,
  error: any,
  context: string,
  entityName: string = 'Entity',
): never {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(
    `[${entityName} Repository] ${context}: ${errorMessage}`,
    errorStack,
  );

  // Manejar errores específicos de TypeORM/Postgres
  interface RepositoryError {
    code?: string;
    message?: string;
    stack?: string;
  }

  const repoError = error as RepositoryError;

  if (repoError.code === '23505') {
    throw new ConflictException(`${entityName} already exists`);
  }

  throw new InternalServerErrorException(`Failed to ${context.toLowerCase()}`);
}

/**
 * Maneja errores de servicio de forma consistente
 * @param logger Instancia del logger
 * @param error Error capturado
 * @param context Contexto del error (nombre del método o operación)
 */
export function handleServiceError(
  logger: Logger,
  error: any,
  context: string,
): never {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(`[Service] ${context}: ${errorMessage}`, errorStack);

  // Re-lanzar excepciones HTTP existentes
  if (error instanceof HttpException) {
    throw error;
  }

  throw new InternalServerErrorException(`Failed to ${context.toLowerCase()}`);
}
