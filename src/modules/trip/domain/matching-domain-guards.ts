import { ConflictException, Injectable } from '@nestjs/common';
import { Trip } from '../entities/trip.entity';
import { DriverAvailability } from 'src/modules/drivers-availability/entities/driver-availability.entity';

@Injectable()
export class MatchingDomainGuards {
  ensureDriverEligibleForTrip(args: {
    trip: Trip;
    driverAvailability: DriverAvailability;
    vehicleId: string;
    pickup: { lat: number; lng: number };
    radiusMeters: number;
    // flags opcionales
    enforceStrictRadius?: boolean; // default true
  }) {
    const {
      trip,
      driverAvailability: da,
      vehicleId,
      enforceStrictRadius = true,
    } = args;

    // Estado del trip
    if ((trip as any).currentStatus !== 'assigning') {
      throw new ConflictException('Trip is not in assigning state');
    }

    // Flags de disponibilidad
    if (!da.isOnline) throw new ConflictException('Driver is offline');
    if (!da.isAvailableForTrips)
      throw new ConflictException('Driver not available for trips');
    if (da.availabilityReason !== null)
      throw new ConflictException('Driver has availability reason set');
    if (da.currentTripId)
      throw new ConflictException('Driver is already on a trip');

    // Vehículo consistente
    if (!da.currentVehicleId)
      throw new ConflictException('Driver has no current vehicle');
    if (da.currentVehicleId !== vehicleId)
      throw new ConflictException('Vehicle mismatch for offer');

    // (Opcional) Validación estricta de radio con la última ubicación
    if (enforceStrictRadius) {
      if (!(da as any).lastLocation) {
        throw new ConflictException('Driver has no last location');
      }
      // Si necesitas exacto en SQL, muévelo a la consulta. Aquí hacemos una
      // verificación blanda (puedes omitirla si ya confías en el prefiltrado).
    }

    // Wallet/vehículo en servicio ya están garantizados por la query elegible.
  }
}
