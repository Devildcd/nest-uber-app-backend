import {
    IsUUID,
    IsEnum,
    IsOptional,
    IsDateString,
    IsString,
    Length,
    IsNumber,
    Min,
    IsObject,
    Matches,
} from 'class-validator';
import { TripStatus, PaymentMode } from '../entities/trip.entity';
import { FareBreakdown } from '../interfaces/trip.interfaces';

export class UpdateTripDto {
    // asignaciones
    @IsOptional()
    @IsUUID()
    driverId?: string;

    @IsOptional() @IsUUID()
    vehicleId?: string;

    @IsOptional() @IsUUID()
    orderId?: string;

    // estado y timestamps del ciclo
    @IsOptional() @IsEnum(TripStatus)
    currentStatus?: TripStatus;

    @IsOptional() @IsDateString()
    acceptedAt?: string;

    @IsOptional() @IsDateString()
    pickupEtaAt?: string;

    @IsOptional() @IsDateString()
    arrivedPickupAt?: string;

    @IsOptional() @IsDateString()
    startedAt?: string;

    @IsOptional() @IsDateString()
    completedAt?: string;

    @IsOptional() @IsDateString()
    canceledAt?: string;

    // datos de liquidación / tarifa
    @IsOptional() @Matches(/^[A-Z]{3}$/)
    fareFinalCurrency?: string;

    @IsOptional() @IsNumber() @Min(0)
    fareDistanceKm?: number;

    @IsOptional() @IsNumber() @Min(0)
    fareDurationMin?: number;

    @IsOptional() @IsNumber() @Min(1)
    fareSurgeMultiplier?: number;

    @IsOptional() @IsNumber() @Min(0)
    fareTotal?: number;

    // JSON libre (si quieres, luego lo tipas mejor)
    @IsOptional() @IsObject()
  fareBreakdown?: Record<string, FareBreakdown>;

    // otros
    @IsOptional() @IsEnum(PaymentMode)
    paymentMode?: PaymentMode;

    @IsOptional() @IsString() @Length(1, 500)
    pickupAddress?: string;
}
