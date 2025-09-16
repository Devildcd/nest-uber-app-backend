import {
  IsNumber,
  IsOptional,
  IsString,
  isUUID,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class DriverBalanceDepositDto {
  @IsUUID()
  driverId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsUUID()
  collectionPointId: string;

  @IsUUID()
  collectedBy: string; // staff user id

  @IsString()
  @Length(3, 250)
  reason: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @IsOptional()
  @IsUUID()
  idempotencyKey?: string; // optional idempotency key

  @IsOptional()
  @IsString()
  @Length(1, 200)
  externalTransactionId?: string; // e.g., receipt id from cashier app
}
