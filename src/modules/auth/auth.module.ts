import { Module } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { AuthCredentialsRepository } from '../user/repositories/auth-credentials.repository';
import { TokenService } from './services/token.service';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { UserModule } from '../user/user.module';
import { SessionRepository } from './repositories/session.repository';
import { AuthController } from './controllers/auth.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, SessionRepository]),
    // JwtModule.registerAsync({}),
    UserModule,
  ],
  providers: [
    AuthService,
    AuthCredentialsRepository,
    TokenService,
    JwtService,
    SessionRepository,
  ],
  exports: [AuthService, AuthCredentialsRepository],
  controllers: [AuthController],
})
export class AuthModule {}
