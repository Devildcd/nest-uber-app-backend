import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AuthEvents,
  UserLoggedInEvent,
} from 'src/core/domain/events/auth.events';
import { DriverAvailabilityService } from 'src/modules/drivers-availability/services/driver-availability.service';
import { UserType } from 'src/modules/user/entities/user.entity';
import { UserRepository } from 'src/modules/user/repositories/user.repository';

@Injectable()
export class AuthToAvailabilityListener {
  private readonly logger = new Logger(AuthToAvailabilityListener.name);
  constructor(
    private readonly availabilityService: DriverAvailabilityService,
    private readonly usersRepo: UserRepository,
  ) {}

  @OnEvent(AuthEvents.UserLoggedIn)
  async onDriverLogin(ev: UserLoggedInEvent) {
    try {
      const user = await this.usersRepo.findById(ev.userId);
      if (!user || user.userType !== UserType.DRIVER) return;

      await this.availabilityService.markOnlineFromLogin(ev.userId, ev.at);
    } catch (e) {
      this.logger.warn(`onDriverLogin failed for user=${ev.userId}`, e);
    }
  }
}
