import { Module } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { AuthCredentialsRepository } from './repositories/auth-credentials.repository';

@Module({
  providers: [AuthService, AuthCredentialsRepository],
  exports: [AuthService, AuthCredentialsRepository],
})
export class AuthModule {}
