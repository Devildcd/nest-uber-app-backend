import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import {
  BackgroundCheckStatus,
  OnboardingStatus,
} from '../entities/driver-profile.entity';
import { EmergencyContactDto } from './emergency-contact.dto';

export class DriverProfileResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Identificador único del driver profile',
    example: 'a3f1c2d4-5678-90ab-cdef-1234567890ab',
  })
  id: string;

  @Expose()
  @Transform(({ obj }: { obj: { user?: { id: string } } }) => obj.user?.id)
  @ApiProperty({
    description: 'Identificador del usuario asociado',
    example: 'b1e2f3a4-5678-90ab-cdef-1234567890ab',
  })
  userId: string;

  @Expose()
  @ApiProperty({
    description: 'Número de licencia de conducir',
    example: 'D1234567',
  })
  driverLicenseNumber: string;

  @Expose()
  @ApiProperty({
    description: 'Fecha de expiración de la licencia (ISO 8601)',
    example: '2026-12-31T00:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  driverLicenseExpirationDate: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'URL de la imagen de la licencia de conducir',
    example: 'https://cdn.example.com/licenses/D1234567.png',
  })
  driverLicensePictureUrl?: string;

  @Expose()
  @ApiProperty({
    description: 'Estado de la verificación de antecedentes',
    enum: BackgroundCheckStatus,
    example: BackgroundCheckStatus.PENDING,
  })
  backgroundCheckStatus: BackgroundCheckStatus;

  @Expose()
  @ApiPropertyOptional({
    description:
      'Fecha en que se completó la verificación de antecedentes (ISO 8601)',
    example: '2025-07-10T12:34:56.000Z',
    type: String,
    format: 'date-time',
  })
  backgroundCheckDate?: string;

  @Expose()
  @ApiProperty({
    description: 'Indica si el driver está aprobado para operar',
    example: true,
  })
  isApproved: boolean;

  @Expose()
  @ApiProperty({
    description: 'Estado del proceso de onboarding',
    enum: OnboardingStatus,
    example: OnboardingStatus.REGISTERED,
  })
  onboardingStatus: OnboardingStatus;

  @Expose()
  @ApiPropertyOptional({
    description: 'Información de contacto de emergencia',
    type: () => EmergencyContactDto,
  })
  emergencyContactInfo?: EmergencyContactDto;

  @Expose()
  @ApiPropertyOptional({
    description: 'Última vez que el driver estuvo en línea (ISO 8601)',
    example: '2025-07-14T18:45:00.000Z',
    type: String,
    format: 'date-time',
  })
  lastOnlineAt?: string;

  @Expose()
  @ApiProperty({
    description: 'Fecha de creación del registro (ISO 8601)',
    example: '2025-07-01T09:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt: string;

  @Expose()
  @ApiProperty({
    description: 'Fecha de última actualización del registro (ISO 8601)',
    example: '2025-07-12T15:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  updatedAt: string;
}
