import { PaymentMode, TripStatus } from '../entities/trip.entity';
import { FareBreakdown } from '../interfaces/trip.interfaces';

export class TripResponseDto {
  id!: string;

  passengerId!: string;
  driverId?: string | null;
  vehicleId?: string | null;
  orderId?: string | null;

  currentStatus!: TripStatus;
  paymentMode!: PaymentMode;

  requestedAt!: string;
  acceptedAt?: string | null;
  pickupEtaAt?: string | null;
  arrivedPickupAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  canceledAt?: string | null;

  // Para el front es práctico {lat,lng}
  pickupPoint!: { lat: number; lng: number };
  pickupAddress?: string | null;

  fareFinalCurrency?: string | null;
  fareDistanceKm?: number | null;
  fareDurationMin?: number | null;
  fareSurgeMultiplier!: number;
  fareTotal?: number | null;
  fareBreakdown?: Record<string, FareBreakdown> | null;

  createdAt!: string;
  updatedAt!: string;
}
