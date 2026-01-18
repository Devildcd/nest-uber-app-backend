import { FareBreakdown } from 'src/common/interfaces/fare-breakdown.interface';

export class TripQuoteDto {
  currency: string;
  surgeMultiplier: number;
  totalEstimated: number;
  breakdown: FareBreakdown;
}
