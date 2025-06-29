import { Logger } from '@nestjs/common';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

/**
 * Centraliza la conversión de errores de TypeORM a excepciones de NestJS.
 * Detecta códigos de error de Postgres y lanza la excepción adecuada.
 */
export function handleRepositoryError(
  logger: Logger,
  error: unknown,
  method: string,
  entityName: string,
): never {
  // Loguea detalles para diagnóstico
  if (error instanceof Error) {
    logger.error(
      `${entityName}.${method} failed: ${error.message}`,
      error.stack,
    );
  } else {
    logger.error(`${entityName}.${method} failed: ${JSON.stringify(error)}`);
  }

  // Manejo de errores específicos de Postgres via QueryFailedError
  if (error instanceof QueryFailedError) {
    const driverError = (
      error as QueryFailedError & {
        driverError: {
          code: string;
          detail?: string;
          column?: string;
          constraint?: string;
        };
      }
    ).driverError;

    switch (driverError.code) {
      // Unique violation
      case '23505':
        throw new ConflictException(
          `${entityName} conflict: ${driverError.detail}`,
        );

      // Foreign key violation
      case '23503':
        throw new ConflictException(
          `${entityName} foreign key violation: ${driverError.detail}`,
        );

      // Not null violation
      case '23502':
        throw new ConflictException(
          `${entityName} null constraint: ${driverError.column} cannot be null`,
        );

      // Check violation
      case '23514':
        throw new ConflictException(
          `${entityName} check constraint violation: ${driverError.constraint}`,
        );

      // Exclusion violation
      case '23P01':
        throw new ConflictException(
          `${entityName} exclusion constraint violation: ${driverError.constraint}`,
        );

      default:
        // Otros códigos que empiecen por '23' (constraint violations)
        if (driverError.code.startsWith('23')) {
          throw new ConflictException(
            `${entityName} constraint violation: ${driverError.detail}`,
          );
        }
    }
  }

  // Mapeo de otros tipos de errores de TypeORM o Nest
  if (
    error instanceof NotFoundException ||
    error instanceof ConflictException ||
    error instanceof InternalServerErrorException
  ) {
    throw error;
  }

  // Fallback genérico
  throw new InternalServerErrorException(
    `Unexpected error in ${entityName}.${method}`,
  );
}
