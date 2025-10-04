import { INestApplication } from '@nestjs/common';
import { SwaggerService } from './swagger.service';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UserModule } from 'src/modules/user/user.module';
import { SwaggerOptions } from 'src/common/interfaces/swagger-options.interface';

const swaggerConfigs: SwaggerOptions[] = [
  {
    title: 'Uber-app-backend',
    description: 'Documentación de todos los endpoints',
    version: '1.0',
    path: 'api',
    enabledEnvVar: 'SWAGGER_ENABLE_GLOBAL',
  },
  {
    title: 'Authentication',
    version: '1.0-auth',
    path: 'docs/auth',
    include: [AuthModule],
    enabledEnvVar: 'SWAGGER_ENABLE_AUTH',
  },
  {
    title: 'Users',
    version: '1.0-users',
    path: 'docs/users',
    include: [UserModule],
    enabledEnvVar: 'SWAGGER_ENABLE_USERS',
  },
];

export const swaggerOptions = swaggerConfigs;

export function configureSwagger(app: INestApplication): void {
  const swagger = app.get(SwaggerService);
  swagger.setup(app);
}
