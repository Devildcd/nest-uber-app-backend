import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import configurations from './index';
import { validationSchema } from './validation.schema';
import { SwaggerModule } from 'src/docs/swagger/swagger.module';
import { swaggerOptions } from 'src/docs/swagger/swagger.bootstrap';
import { DatabaseModule } from 'src/database/database.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: configurations,
      validationSchema: validationSchema,
      envFilePath: ['.env'],
    }),
    SwaggerModule.forRoot(swaggerOptions),
    DatabaseModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: Number(process.env.RATE_LIMIT_TTL || 60) * 1000, // Convertir segundos a milisegundos
          limit: Number(process.env.RATE_LIMIT_MAX || 10),
        },
      ],
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
