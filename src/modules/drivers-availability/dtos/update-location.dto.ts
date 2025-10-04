import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateDriverLocationDto {
  @IsNumber() lat!: number;
  @IsNumber() lng!: number;

  @IsOptional()
  @IsString()
  lastLocationTimestamp?: string; // ISO
}
