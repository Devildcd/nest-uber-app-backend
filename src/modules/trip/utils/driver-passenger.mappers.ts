import { Vehicle } from 'src/modules/vehicles/entities/vehicle.entity';
import {
  DriverSlimForPassengerDto,
  PassengerSlimForDriverDto,
  VehicleSlimForPassengerDto,
} from '../dtos/trip/driver-passenger.dto';
import { User } from 'src/modules/user/entities/user.entity';

export function maskPhone(phone?: string | null): string | null {
  if (!phone) return null;
  // máscara simple: deja últimos 3
  const last = phone.slice(-3);
  return `••• ••${last}`;
}

export function toDriverSlimForPassenger(
  user: User | null | undefined,
  rating?: { avg: number | null; count: number | null } | null,
): DriverSlimForPassengerDto | null {
  if (!user) return null;

  const phone = user.phoneNumber ?? null;
  return {
    id: user.id,
    name: user.name ?? null,
    photoUrl: user.profilePictureUrl ?? null,
    phoneMasked: maskPhone(user.phoneNumber ?? null),
    phone,
    ratingAvg: rating?.avg ?? null,
    ratingCount: rating?.count ?? null,
  };
}

export function toVehicleSlimForPassenger(
  vehicle: Vehicle | null | undefined,
): VehicleSlimForPassengerDto | null {
  if (!vehicle) return null;
  return {
    id: vehicle.id,
    make: vehicle.make ?? null,
    model: vehicle.model ?? null,
    color: vehicle.color ?? null,
    plateNumber: vehicle.plateNumber ?? null,
  };
}

export function toPassengerSlimForDriver(
  user: User | null | undefined,
): PassengerSlimForDriverDto | null {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name ?? null,
    photoUrl: user.profilePictureUrl ?? null,
    phoneMasked: maskPhone(user.phoneNumber ?? null),
  };
}
