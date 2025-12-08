import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRepository } from '../repositories/user.repository';
import { PassengerLocationPingDto } from '../dto/passenger-location-ping.dto';
import { toGeoPoint } from 'src/common/utils/geo.utils';
import { UserType } from '../entities/user.entity';

const MAX_LOCATION_AGE_SECONDS = 300; // 5 min
const MIN_WRITE_INTERVAL_SECONDS = 15; // min intervalo real de escritura
const MIN_DISTANCE_METERS = 50; // umbral de movimiento

@Injectable()
export class PassengerLocationService {
  constructor(private readonly usersRepo: UserRepository) {}

  async ingestPassengerPing(userId: string, dto: PassengerLocationPingDto) {
    // 1) validar usuario / tipo
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (user.userType !== UserType.PASSENGER) {
      throw new ForbiddenException('Only passengers can update location');
    }

    const now = new Date();
    const hasLocation =
      typeof dto.lat === 'number' && typeof dto.lng === 'number';

    // 2) decidir si guardamos (umbrales)
    let shouldSaveLocation = false;
    if (hasLocation) {
      const lastUpdated = user.updatedAt
        ? new Date(user.updatedAt).getTime()
        : 0;
      const secondsSinceLastWrite = (now.getTime() - lastUpdated) / 1000;

      if (dto.forceSave) {
        shouldSaveLocation = true;
      } else if (!user.currentLocation) {
        shouldSaveLocation = true;
      } else if (secondsSinceLastWrite >= MAX_LOCATION_AGE_SECONDS) {
        shouldSaveLocation = true;
      } else if (secondsSinceLastWrite >= MIN_WRITE_INTERVAL_SECONDS) {
        const distance = await this.usersRepo.distanceToCurrentLocation(
          userId,
          dto.lng!,
          dto.lat!,
        );
        shouldSaveLocation =
          distance === null || distance >= MIN_DISTANCE_METERS;
      }
    }

    // 3) persistencia
    if (hasLocation && shouldSaveLocation) {
      const saved = await this.usersRepo.updatePassengerLocationByUserId(
        userId,
        {
          __lat__: dto.lat!,
          __lng__: dto.lng!,
          // Si quieres dejar rastro de “último reporte” en otra columna plana, añádela aquí.
          // lastPresenceTimestamp: now as any
        } as any,
      );

      return {
        id: saved.id,
        currentLocation: saved.currentLocation,
        updatedAt: saved.updatedAt,
      };
    }

    // 4) heartbeat → no toques DB (evitas UpdateValuesMissingError). Devuelve estado actual.
    const current = await this.usersRepo.findOne({ where: { id: userId } });
    return {
      id: current!.id,
      currentLocation: current!.currentLocation,
      updatedAt: current!.updatedAt,
    };
  }
}
