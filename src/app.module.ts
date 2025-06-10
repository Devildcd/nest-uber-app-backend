import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MailModule } from './infrastructure/notifications/mail/mail.module';
import { SmsModule } from './infrastructure/notifications/sms/sms.module';
import { TypeormModule } from './infrastructure/persistence/typeorm/typeorm.module';
import { MongooseModule } from './infrastructure/persistence/mongoose/mongoose.module';
import { GatewaysModule } from './websockets/gateways/gateways.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { TripsModule } from './modules/trips/trips.module';

@Module({
  imports: [MailModule, SmsModule, TypeormModule, MongooseModule, GatewaysModule, UsersModule, AuthModule, TripsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
