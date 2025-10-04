import { IsNumber, IsOptional, IsString } from 'class-validator';

export class WsDriverLocationDto {
  @IsNumber() lat!: number;
  @IsNumber() lng!: number;
  @IsOptional() @IsString() ts?: string; // ISO opcional
}
