import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class StartArrivingDto {
  @IsUUID()
  driverId: string; // validaremos que coincide con trips.driver_id

  @ApiPropertyOptional({ description: 'ETA estimado en minutos' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  etaMinutes?: number;

  @ApiPropertyOptional({ description: 'Posición actual del driver (lat)' })
  @IsOptional()
  @IsNumber()
  driverLat?: number;

  @ApiPropertyOptional({ description: 'Posición actual del driver (lng)' })
  @IsOptional()
  @IsNumber()
  driverLng?: number;
}
