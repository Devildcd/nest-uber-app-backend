import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SwaggerService } from './swagger.service';
import { SwaggerOptions } from 'src/core/interfaces/swagger-options.interface';

@Global()
@Module({})
export class SwaggerModule {
  static forRoot(options: SwaggerOptions[]): DynamicModule {
    const optionsProvider: Provider = {
      provide: 'SWAGGER_OPTIONS',
      useValue: options,
    };

    return {
      module: SwaggerModule,
      imports: [ConfigModule],
      providers: [optionsProvider, SwaggerService],
      exports: [SwaggerService],
    };
  }
}
