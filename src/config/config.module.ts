import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import configurations from './index';
import { validationSchema } from './validation.schema';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: configurations,
      validationSchema: validationSchema,
      envFilePath: ['.env'],
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
