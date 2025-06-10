import Joi from 'joi';

export const validationSchema = Joi?.object({
  PORT: Joi.number().default(3000),
  CORS_ORIGINS: Joi.string().default('*'),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),
});
