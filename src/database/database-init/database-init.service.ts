import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, ClientConfig } from 'pg';

@Injectable()
export class DatabaseInitService {
  private readonly logger = new Logger(DatabaseInitService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Asegura que la base de datos exista; la crea si no existe.
   */
  public async ensureDatabaseExists(): Promise<void> {
    const dbName = this.getEnv('DB_NAME');

    const clientConfig: ClientConfig = {
      host: this.getEnv('DB_HOST'),
      port: Number(this.getEnv('DB_PORT', '5432')),
      user: this.getEnv('DB_USER'),
      password: this.getEnv('DB_PASSWORD'),
      database: this.getEnv('DB_DEFAULT', 'postgres'),
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const client = new Client(clientConfig);

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await client.connect();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await client.query(`CREATE DATABASE "${dbName}"`);
      this.logger.log(`Data base "${dbName}" created.`);
    } catch (error: unknown) {
      this.processError(error, dbName);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await client.end();
    }
  }

  /**
   * Obtiene y valida una variable de entorno.
   */
  private getEnv(key: string, fallback?: string): string {
    const value = this.configService.get<string>(key);
    if (value) {
      return value;
    }
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Missing environment variable: ${key}`);
  }

  /**
   * Procesa errores de creación de la base de datos.
   */
  private processError(error: unknown, dbName: string): void {
    if (this.isDatabaseExistsError(error)) {
      this.logger.log(`Data base "${dbName}" already exists.`);
      return;
    }

    if (error instanceof Error) {
      this.logger.error(`Error creating database: ${error.message}`);
      throw error;
    }

    this.logger.error('Unknown error while creating database.');
    throw new Error('Unknown error while creating database.');
  }

  /**
   * Type guard para errores PG de base existente (código 42P04).
   */
  private isDatabaseExistsError(error: unknown): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === '42P04'
    );
  }
}
