import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus,
  ConflictException, BadRequestException, ServiceUnavailableException,
  InternalServerErrorException, RequestTimeoutException, Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { fail } from './response-helpers';

type PgMeta = { code?: string; detail?: string; constraint?: string; table?: string; column?: string; message?: string };

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    // 1) HttpException “normal”
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse() as any;
      const message =
        typeof response === 'string'
          ? response
          : response?.message || exception.message || 'Error';
      const code = response?.error || exception.name;
      return res.status(status).json(fail(message, code));
    }

    // 2) TypeORM / Postgres
    if (exception instanceof QueryFailedError) {
      const meta: PgMeta = (exception as any).driverError || {};
      const httpEx = this.mapPgCode(meta.code, meta);
      const status = httpEx.getStatus();
      const msg = httpEx.message || 'Database error';
      return res.status(status).json(fail(msg, httpEx.name, process.env.NODE_ENV !== 'production' ? meta : undefined));
    }

    // 3) class-validator (cuando ValidationPipe lanza error "crudo")
    const anyEx = exception as any;
    if (anyEx?.message && Array.isArray(anyEx?.message) && anyEx?.statusCode === 400) {
      // Nest ValidationPipe default format
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json(fail('Validation failed', 'BadRequestException', anyEx?.message));
    }

    // 4) Fallback
    this.logger.error('Unexpected error', (exception as any)?.stack || String(exception));
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(fail('Unexpected error', 'InternalServerError'));
  }

  private mapPgCode(code?: string, meta?: PgMeta): HttpException {
    const byConstraint: Record<string, string> = {
      // personaliza con tus nombres reales de índices/constraints
      trips_passenger_id_fkey: 'Passenger no existe.',
      trips_driver_id_fkey: 'Driver no existe.',
      trips_vehicle_id_fkey: 'Vehicle no existe.',
      // ejemplo único:
      // trips_order_id_key: 'Order ya está asociado a un trip.',
    };
    const msg = (fallback: string) =>
      (meta?.constraint && byConstraint[meta.constraint]) || fallback;

    switch (code) {
      case '23505': return new ConflictException(msg('Valor duplicado (unique violation).'));
      case '23503': return new BadRequestException(msg('Violación de llave foránea.'));
      case '23502': return new BadRequestException(msg('Campo requerido no puede ser nulo.'));
      case '23514': return new BadRequestException(msg('Violación de constraint CHECK.'));
      case '22P02': return new BadRequestException(msg('Sintaxis de entrada inválida (por ejemplo UUID).'));
      case '22001': return new BadRequestException(msg('Texto demasiado largo para la columna.'));
      case '22003': return new BadRequestException(msg('Valor numérico fuera de rango.'));
      case '40001': return new ConflictException(msg('Fallo de serialización. Intenta de nuevo.'));
      case '40P01': return new ServiceUnavailableException(msg('Deadlock detectado. Intenta nuevamente.'));
      case '55P03': return new ServiceUnavailableException(msg('Bloqueo no disponible.'));
      case '57014': return new RequestTimeoutException(msg('Consulta cancelada.'));
      case '53300': return new ServiceUnavailableException(msg('Demasiadas conexiones.'));
      default:      return new InternalServerErrorException('Error de base de datos.');
    }
  }
}