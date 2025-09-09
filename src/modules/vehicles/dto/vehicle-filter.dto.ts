// src/modules/vehicles/dto/vehicle-filter.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VehicleStatus } from '../entities/vehicle.entity';

export class VehicleFilterDto {
  @ApiPropertyOptional({
    description: 'Filtrar por driver (UUID)',
    example: 'a1b2c3d4-1111-2222-3333-abcdef123456',
  })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por driverProfile (UUID)',
    example: 'd4c3b2a1-4444-5555-6666-fedcba654321',
  })
  @IsOptional()
  @IsUUID()
  driverProfileId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por vehicleType (UUID)',
    example: 'b7a8d6f4-1234-5678-90ab-cdef12345678',
  })
  @IsOptional()
  @IsUUID()
  vehicleTypeId?: string;

  @ApiPropertyOptional({
    description: 'Coincidencia parcial de plateNumber (ILIKE)',
    example: 'ABC123',
  })
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por status (enum)',
    example: VehicleStatus.APPROVED,
  })
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por isActive',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Año mínimo del vehículo (rango)',
    example: 2015,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minYear?: number;

  @ApiPropertyOptional({
    description: 'Año máximo del vehículo (rango)',
    example: 2025,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(new Date().getFullYear() + 1)
  maxYear?: number;

  @ApiPropertyOptional({
    description: 'Capacidad mínima (nº pasajeros)',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minCapacity?: number;

  @ApiPropertyOptional({
    description: 'Capacidad máxima (nº pasajeros)',
    example: 6,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(20)
  maxCapacity?: number;
}
