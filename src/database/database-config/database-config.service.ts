import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import * as path from 'path';

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const isProd = nodeEnv === 'production';
    // Flag en .env para controlar migraciones
    const runMigrations = this.configService.get<boolean>(
      'RUN_MIGRATIONS',
      false,
    );

    const migrationsDir = isProd
      ? join(__dirname, '../dist/migrations/*{.js,.js.map}')
      : join(__dirname, '../src/database/migrations/*{.ts,.js}');

    return {
      type: 'postgres',
      host: this.configService.get<string>('DB_HOST'),
      port: +this.configService.get<string>('DB_PORT', '5432'),
      username: this.configService.get<string>('DB_USER'),
      password: this.configService.get<string>('DB_PASSWORD'),
      database: this.configService.get<string>('DB_NAME'),

      // Nunca uses synchronize en prod
      synchronize:
        !isProd && this.configService.get<boolean>('DB_SYNCHRONIZE', false),

      logging: this.configService.get<boolean>('DB_LOGGING', false),
      autoLoadEntities: true,

      // Ejecuta migraciones al arrancar solo si lo habilitas
      migrationsRun: runMigrations,
      migrations: [migrationsDir],
      migrationsTableName: 'migrations_history',

      // Habilita el CLI para generar nuevas migraciones:
      //   cli: {
      //     migrationsDir: 'src/migrations',
      //   },
    };
  }
}

function join(...paths: string[]): string {
  return path.join(...paths);
}
