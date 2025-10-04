import { Module } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { AuthCredentialsRepository } from '../user/repositories/auth-credentials.repository';
import { TokenService } from './services/token.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { UserModule } from '../user/user.module';
import { SessionRepository } from './repositories/session.repository';
import { AuthController } from './controllers/auth.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { DeviceService } from 'src/modules/auth/services/device.service';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, SessionRepository]),
    UserModule,
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (cs: ConfigService) => ({
        secret: cs.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: cs.get<string>('JWT_ACCESS_EXPIRES_IN'),
          issuer: cs.get<string>('JWT_ISSUER'),
          audience: cs.get<string>('JWT_AUDIENCE'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    AuthCredentialsRepository,
    TokenService,
    DeviceService,
    JwtService,
    JwtStrategy,
    JwtAuthGuard,
    {
      provide: SessionRepository, // El "token" de inyección será la propia clase
      useFactory: (dataSource: DataSource) => {
        // La fábrica recibe el DataSource inyectado...
        return new SessionRepository(dataSource); // ...y lo usa para crear la instancia
      },
      inject: [DataSource], // Le decimos a NestJS que inyecte el DataSource en la fábrica
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [
    AuthService,
    AuthCredentialsRepository,
    JwtAuthGuard,
    SessionRepository,
    TokenService,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
