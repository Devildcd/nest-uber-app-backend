import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { MailModule } from './infrastructure/notifications/mail/mail.module';
import { SmsModule } from './infrastructure/notifications/sms/sms.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from './config/config.module';
import { SwaggerModule } from './docs/swagger/swagger.module';
import { UserModule } from './modules/user/user.module';
import { TripModule } from './modules/trip/trip.module';
import { DatabaseConfigService } from './database/database-config/database-config.service';
import { DatabaseModule } from './database/database.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { DriverProfilesModule } from './modules/driver-profiles/driver-profiles.module';
import { VehicleCategoryModule } from './modules/vehicle-category/vehicle-category.module';
import { VehicleTypesModule } from './modules/vehicle-types/vehicle-types.module';

@Module({
  imports: [
    MailModule,
    SmsModule,
    AuthModule,
    ConfigModule,
    SwaggerModule,
    UserModule,
    TripModule,
    DatabaseModule,
    VehiclesModule,
    VehicleCategoryModule,
    DriverProfilesModule,
    VehicleTypesModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseConfigService],
})
export class AppModule {}
