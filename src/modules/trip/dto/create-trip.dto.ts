import {
  IsUUID,
  IsEnum,
  IsDateString,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMode } from '../entities/trip.entity';
import { GeoPointDto } from 'src/common/dto/geo-point.dto';


export class CreateTripDto {
  @IsUUID()
  passengerId!: string;

  @IsEnum(PaymentMode)
  paymentMode!: PaymentMode;

  // Server puede ponerla si quieres; si la mandas desde cliente, valida ISO.
  @IsDateString()
  requestedAt!: string;

  @ValidateNested()
  @Type(() => GeoPointDto)
  pickupPoint!: GeoPointDto;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  pickupAddress?: string;
}
