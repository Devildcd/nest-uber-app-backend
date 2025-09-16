import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EmergencyContactDto } from './emergency-contact.dto';
import {
  BackgroundCheckStatus,
  DriverStatus,
} from '../entities/driver-profile.entity';

export class UpdateDriverProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  @ApiPropertyOptional({
    description: 'Nuevo número de licencia',
    example: 'D7654321',
  })
  driverLicenseNumber?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Nueva fecha de expiración (ISO 8601)',
    example: '2027-01-31T00:00:00.000Z',
  })
  driverLicenseExpirationDate?: string;

  @IsOptional()
  @IsUrl()
  @ApiPropertyOptional({
    description: 'Nueva URL de la imagen de licencia',
    example: 'https://cdn.example.com/licenses/D7654321.png',
  })
  driverLicensePictureUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  @ApiPropertyOptional({
    type: EmergencyContactDto,
    description: 'Nuevo contacto de emergencia',
  })
  emergencyContactInfo?: EmergencyContactDto;

  @IsOptional()
  @IsEnum(DriverStatus)
  @ApiPropertyOptional({
    description: 'Nuevo estado operativo del driver',
    enum: DriverStatus,
    example: DriverStatus.ACTIVE,
  })
  driverStatus?: DriverStatus;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Nueva fecha límite de prioridad pagada (ISO 8601)',
    example: '2025-08-01T00:00:00.000Z',
  })
  paidPriorityUntil?: string;

  @IsOptional()
  @IsEnum(BackgroundCheckStatus)
  @ApiPropertyOptional({
    description: 'Nuevo estado de verificación de antecedentes',
    enum: BackgroundCheckStatus,
    example: BackgroundCheckStatus.PENDING_BACKGROUND_CHECK,
  })
  backgroundCheckStatus?: BackgroundCheckStatus;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Nueva fecha de verificación de antecedentes (ISO 8601)',
    example: '2025-07-10T12:34:56.000Z',
  })
  backgroundCheckDate?: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Indica si el driver está aprobado para operar',
    example: true,
  })
  isApproved?: boolean;
}
