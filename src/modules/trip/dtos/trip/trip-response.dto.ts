import { PaymentMode, TripStatus } from '../../entities/trip.entity';
import { FareBreakdown } from '../../interfaces/trip.interfaces';

export class TripStopDto {
  seq!: number;
  point!: { lat: number; lng: number };
  address?: string | null;
  placeId?: string | null;
  notes?: string | null;
  plannedArrivalAt?: string | null;
  arrivedAt?: string | null;
  completedAt?: string | null;
}

export class TripResponseDto {
  id!: string;

  passengerId!: string;
  passengerName?: string | null;
  passengerPhone?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  orderId?: string | null;
  requestedVehicleCategoryId!: string;
  requestedVehicleCategoryName?: string | null;

  stops?: TripStopDto[];

  requestedServiceClassId!: string;
  requestedServiceClassName?: string | null;

  currentStatus!: TripStatus;
  paymentMode!: PaymentMode;
  fareEstimatedTotal?: number | null;

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
