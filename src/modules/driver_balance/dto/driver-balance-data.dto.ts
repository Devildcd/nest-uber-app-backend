// dto/driver-balance-data.dto.ts
import { Expose, Type } from 'class-transformer';
import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
} from 'class-validator';

export type WalletStatus = 'active' | 'blocked';

export class DriverBalanceDataDto {
  @IsUUID()
  @Expose()
  walletId: string;

  @IsUUID()
  @Expose()
  driverId: string;

  /**
   * Current available balance (decimal), e.g. 123.45
   * Server should ensure rounding to 2 decimals.
   */
  @IsNumber()
  @Expose()
  currentWalletBalance: number;

  /** Amounts that are held/locked (disputes, preauth) */
  @IsNumber()
  @Expose()
  heldWalletBalance: number;

  /** Total earned from trips (gross or net depending on your business rule) */
  @IsNumber()
  @Expose()
  totalEarnedFromTrips: number;

  @IsString()
  @Expose()
  currency: string; // e.g. 'CUP', 'USD'

  @IsOptional()
  @IsDateString()
  @Expose()
  lastPayoutAt?: string | null;

  @IsNumber()
  @Expose()
  minPayoutThreshold: number;

  @IsOptional()
  @IsUUID()
  @Expose()
  payoutMethodId?: string | null;

  @IsIn(['active', 'blocked'])
  @Expose()
  status: WalletStatus;

  @IsDateString()
  @Expose()
  lastUpdated: string;

  @IsDateString()
  @Expose()
  createdAt: string;

  @IsDateString()
  @Expose()
  updatedAt: string;
}
