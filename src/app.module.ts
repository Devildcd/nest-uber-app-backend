import { WsCoreModule } from './core/ws/ws-core.module';
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
import { TransactionsModule } from './modules/transactions/transactions.module';
import { OrdersModule } from './modules/orders/orders.module';
import { DriversAvailabilityModule } from './modules/drivers-availability/drivers-availability.module';
import { VehicleServiceClassesModule } from './modules/vehicle-service-classes/vehicle-service-classes.module';
import { DriverBalanceModule } from './modules/driver_balance/driver_balance.module';
import { CashColletionsPointsModule } from './modules/cash_colletions_points/cash_colletions_points.module';
import { OutboxModule } from './infrastructure/outbox/outbox.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { WsModule } from './infrastructure/ws/ws.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CoreSettingsModule } from './modules/core-settings/core-settings.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ScheduleModule } from '@nestjs/schedule';
@Module({
  imports: [
    WsCoreModule,
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
    TransactionsModule,
    OrdersModule,
    DriversAvailabilityModule,
    VehicleServiceClassesModule,
    DriverBalanceModule,
    CashColletionsPointsModule,
    OutboxModule,
    QueueModule,
    WsModule,
    EventEmitterModule.forRoot({
      // opciones útiles de eventemitter2
      wildcard: true, // habilita patrones 'trip.*'
      delimiter: '.', // separador de namespaces
      maxListeners: 20, // evita memory leaks
      newListener: false,
      removeListener: false,
      global: true,
    }),
    ScheduleModule.forRoot(),
    CoreSettingsModule,
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseConfigService],
})
export class AppModule {}
