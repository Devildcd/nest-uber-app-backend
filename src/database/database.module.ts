// src/database/database.module.ts
import { Global, Module, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as Joi from 'joi';
import { DatabaseConfigService } from './database-config/database-config.service';
import { DatabaseInitService } from './database-init/database-init.service';

/**
 * Módulo global para inicializar y configurar la base de datos con TypeORM.
 */
@Global()
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        // Configuración global de variables de entorno
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
          validationSchema: Joi.object({
            DB_HOST: Joi.string().required(),
            DB_PORT: Joi.number().default(5432),
            DB_USER: Joi.string().required(),
            DB_PASSWORD: Joi.string().required(),
            DB_NAME: Joi.string().required(),
            DB_DEFAULT: Joi.string().default('postgres'),
            DB_SYNCHRONIZE: Joi.boolean().default(false),
            DB_LOGGING: Joi.boolean().default(false),
            NODE_ENV: Joi.string()
              .valid('development', 'production', 'test')
              .default('development'),
          }),
        }),

        // Inicialización asíncrona de TypeORM
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService, DatabaseInitService],
          useFactory: async (
            configService: ConfigService,
            initService: DatabaseInitService,
          ): Promise<
            ReturnType<DatabaseConfigService['createTypeOrmOptions']>
          > => {
            // Asegura que la base exista antes de arrancar TypeORM

            await initService.ensureDatabaseExists();
            return new DatabaseConfigService(
              configService,
            ).createTypeOrmOptions();
          },
        }),
      ],
      providers: [DatabaseConfigService, DatabaseInitService],
      exports: [TypeOrmModule, DatabaseInitService],
    };
  }
}
