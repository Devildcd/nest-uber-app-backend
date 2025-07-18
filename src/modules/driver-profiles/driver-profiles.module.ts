import { Module } from '@nestjs/common';
import { DriverProfileService } from './services/driver-profile.service';
import { DriverProfileController } from './controllers/driver-profiles.controller';
import { DriverProfileRepository } from './repositories/driver-profile.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverProfile } from './entities/driver-profile.entity';
import { UserRepository } from '../user/repositories/user.repository';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DriverProfile, User])],
  providers: [DriverProfileService, UserRepository, DriverProfileRepository],
  controllers: [DriverProfileController],
  exports: [DriverProfileRepository],
})
export class DriverProfilesModule {}
