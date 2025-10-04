import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerService } from './docs/swagger/swagger.service';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { GlobalExceptionFilter } from './common/utils/postgres-exception.filter';
import { SocketIoAdapter } from './realtime/adapters/socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const corsEnv = config.get<string>('CORS_ORIGINS') || 'http://localhost:8100';
  const allowedOrigins = corsEnv.split(',').map((o) => o.trim());

  app.use(cookieParser());

  app.setGlobalPrefix('api');

  app.useWebSocketAdapter(new SocketIoAdapter(app));

  const swagger = app.get(SwaggerService);
  swagger.setup(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Interceptor de respuesta estándar
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  // Filtro global de errores → ApiResponseDto (success=false)
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: (origin, callback) => {
      // permitir requests sin origin (e.g. curl, mobile apps) y permitir el origen dev
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('CORS policy violation'), false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
    ],
    credentials: true, // setea a true solo si vas a usar cookies o auth basado en cookies
    maxAge: 86400,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
