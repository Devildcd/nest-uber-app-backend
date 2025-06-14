import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerService } from './docs/swagger/swagger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const swagger = app.get(SwaggerService);
  swagger.setup(app);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
