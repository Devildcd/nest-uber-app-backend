import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiResponse,
  PaginationMeta,
} from '../interfaces/api-response.interface';

/**
 * Formatea una respuesta exitosa.
 * @param message Mensaje descriptivo
 * @param data Payload de datos
 * @param meta Metadatos opcionales (paginación, etc.)
 */
export function formatSuccessResponse<T>(
  message: string,
  data: T,
  meta?: PaginationMeta,
): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
    meta,
  };
}

/**
 * Formatea una respuesta de error.
 * @param message Mensaje de error
 * @param code Código interno o HTTP
 * @param details Detalles adicionales opcionales
 */
export function formatErrorResponse<T = any>(
  message: string | string[],
  code?: string | string[],
  details?: any,
): ApiResponse<T> {
  const msg = Array.isArray(message) ? message.join('; ') : message;
  const errCode = Array.isArray(code) ? code.join('; ') : code;
  return {
    success: false,
    message: msg,
    error: {
      code: errCode,
      details: details as T,
    },
  };
}

export function handleServiceError<T>(
  logger: Logger,
  error: any,
  context: string,
): ApiResponse<T> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(`${context}: ${errorMessage}`, errorStack);

  // Manejo de excepciones HTTP conocidas
  if (error instanceof ConflictException) {
    return formatErrorResponse(
      'Resource conflict',
      [errorMessage],
      'CONFLICT_ERROR',
    );
  }

  if (error instanceof NotFoundException) {
    return formatErrorResponse(
      'Resource not found',
      [errorMessage],
      'NOT_FOUND',
    );
  }

  if (error instanceof BadRequestException) {
    return formatErrorResponse(
      'Invalid request',
      [errorMessage],
      'BAD_REQUEST',
    );
  }

  // Error genérico para excepciones no manejadas
  return formatErrorResponse(
    'Internal server error',
    [errorMessage],
    'INTERNAL_ERROR',
  );
}
