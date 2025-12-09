import { Module } from '@nestjs/common';
import { UserService } from './services/user.service';
import { UserRepository } from './repositories/user.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { UserController } from './controllers/users.controller';
import { AuthCredentials } from './entities/auth-credentials.entity';
import { Session } from '../auth/entities/session.entity';
import { AuthCredentialsRepository } from './repositories/auth-credentials.repository';
import { DriverProfile } from '../driver-profiles/entities/driver-profile.entity';
import { PassengerLocationService } from './services/passenger-location.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Vehicle,
      AuthCredentials,
      Session,
      DriverProfile,
    ]),
  ],
  providers: [
    UserService,
    UserRepository,
    AuthCredentialsRepository,
    PassengerLocationService,
  ],
  exports: [UserService, UserRepository],
  controllers: [UserController],
})
export class UserModule {}
