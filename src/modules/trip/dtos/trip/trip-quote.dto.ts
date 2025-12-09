import { FareBreakdown } from '../../interfaces/trip.interfaces';

export class TripQuoteDto {
  currency: string;
  surgeMultiplier: number;
  totalEstimated: number;
  breakdown: FareBreakdown;
}
