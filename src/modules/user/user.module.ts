import { Module } from '@nestjs/common';
import { UserService } from './services/user.service';
import { UserRepository } from './repositories/user.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { UserController } from './controllers/users.controller';
import { AuthModule } from '../auth/auth.module';
import { AuthCredentials } from '../auth/entities/auth-credentials.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Vehicle, AuthCredentials]),
    AuthModule,
  ],
  providers: [UserService, UserRepository],
  exports: [UserService, UserRepository],
  controllers: [UserController],
})
export class UserModule {}
