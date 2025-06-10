import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { MailModule } from './infrastructure/notifications/mail/mail.module';
import { SmsModule } from './infrastructure/notifications/sms/sms.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { TripsModule } from './modules/trips/trips.module';
import { ConfigModule } from './config/config.module';

@Module({
  imports: [
    MailModule,
    SmsModule,
    UsersModule,
    AuthModule,
    TripsModule,
    ConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
