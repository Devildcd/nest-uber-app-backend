import { IsBoolean, IsOptional } from 'class-validator';

export class WsDriverStatusDto {
  @IsOptional() @IsBoolean() isOnline?: boolean;
  @IsOptional() @IsBoolean() isAvailableForTrips?: boolean;
}
