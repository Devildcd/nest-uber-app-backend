import {
  Injectable,
  INestApplication,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule as Ns } from '@nestjs/swagger';
import { SwaggerOptions } from 'src/core/interfaces/swagger-options.interface';

@Injectable()
export class SwaggerService implements OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    @Inject('SWAGGER_OPTIONS')
    private readonly configs: SwaggerOptions[],
  ) {}

  onModuleInit(): void {}

  public setup(app: INestApplication): void {
    const globalEnabled = this.config.get<boolean>('SWAGGER_ENABLED', true);
    if (!globalEnabled) return;

    this.configs.forEach((cfg) => {
      if (cfg.enabledEnvVar) {
        const sectionEnabled = this.config.get<boolean>(
          cfg.enabledEnvVar,
          true,
        );
        if (!sectionEnabled) return;
      }

      const keyPrefix = cfg.path.toUpperCase().replace(/\//g, '_');

      const title = this.config.get<string>(
        `SWAGGER_TITLE_${keyPrefix}`,
        cfg.title,
      );

      const version = this.config.get<string>(
        `SWAGGER_VERSION_${keyPrefix}`,
        cfg.version,
      );

      const path = this.config.get<string>(
        `SWAGGER_PATH_${keyPrefix}`,
        cfg.path,
      );

      const builder = new DocumentBuilder().setTitle(title).setVersion(version);

      if (cfg.description) builder.setDescription(cfg.description);

      const document = Ns.createDocument(app, builder.build(), {
        include: cfg.include,
      });

      Ns.setup(path, app, document);
    });
  }
}
