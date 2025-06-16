// data-source.ts
import { DataSource } from 'typeorm';
import * as Joi from 'joi';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Carga y valida .env (puedes extraerlo a un servicio común)
dotenv.config();
const schema = Joi.object({
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
  RUN_MIGRATIONS: Joi.boolean().default(false),
});
interface EnvVars {
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_DEFAULT: string;
  DB_SYNCHRONIZE: boolean;
  DB_LOGGING: boolean;
  NODE_ENV: 'development' | 'production' | 'test';
  RUN_MIGRATIONS: boolean;
}

const validationResult: Joi.ValidationResult = schema.validate(process.env, {
  allowUnknown: true,
});
const error = validationResult.error;
const value = validationResult.value as EnvVars;
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}
const env = value;

const isProd = env.NODE_ENV === 'production';
const runMigrations = env.RUN_MIGRATIONS;

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  synchronize: false,
  logging: env.DB_LOGGING,
  entities: [join(__dirname, 'dist/**/*.entity{.ts,.js}')],
  migrations: [
    isProd
      ? join(__dirname, 'dist/migrations/*{.js,.js.map}')
      : join(__dirname, 'src/database/migrations/*{.ts,.js}'),
  ],
  migrationsRun: runMigrations,
  migrationsTableName: 'migrations_history',
});
