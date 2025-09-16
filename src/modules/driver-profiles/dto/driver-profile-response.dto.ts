import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import {
  BackgroundCheckStatus,
  DriverStatus,
} from '../entities/driver-profile.entity';
import { EmergencyContactDto } from './emergency-contact.dto';
import { UserDto } from './driver-profile-data.dto';

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
  @Type(() => UserDto)
  user?: UserDto;

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
    example: BackgroundCheckStatus.PENDING_BACKGROUND_CHECK,
  })
  backgroundCheckStatus: BackgroundCheckStatus;

  @Expose()
  @ApiPropertyOptional({
    description: 'Fecha de verificación de antecedentes (ISO 8601)',
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
  @ApiPropertyOptional({
    description: 'Información de contacto de emergencia',
    type: () => EmergencyContactDto,
  })
  @Type(() => EmergencyContactDto)
  emergencyContactInfo?: EmergencyContactDto;

  @Expose()
  @ApiProperty({
    description: 'Estado operativo del driver',
    enum: DriverStatus,
    example: DriverStatus.ACTIVE,
  })
  driverStatus: DriverStatus;

  @Expose()
  @ApiPropertyOptional({
    description: 'Fecha límite de prioridad pagada (ISO 8601)',
    example: '2025-08-01T00:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  paidPriorityUntil?: string;

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

  @Expose()
  @ApiPropertyOptional({
    description: 'Fecha de eliminación del registro (ISO 8601)',
    example: '2025-07-20T11:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  deletedAt?: string;
}
