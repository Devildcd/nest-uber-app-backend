import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import configurations from './index';
import { validationSchema } from './validation.schema';
import { SwaggerModule } from 'src/docs/swagger/swagger.module';
import { swaggerOptions } from 'src/docs/swagger/swagger.bootstrap';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: configurations,
      validationSchema: validationSchema,
      envFilePath: ['.env'],
    }),
    SwaggerModule.forRoot(swaggerOptions),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
