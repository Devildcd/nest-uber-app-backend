import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import {
  BackgroundCheckStatus,
  OnboardingStatus,
} from '../entities/driver-profile.entity';

/**
 * DTO que representa un item de la lista de driver profiles
 */
export class DriverProfileListItemDto {
  @Expose()
  @ApiProperty({ example: '0a0777e5-e096-4938-9a77-e284bf9b700f' })
  id: string;

  @Transform(({ obj }: { obj: { user?: { id: string } } }) => obj.user?.id)
  @Expose()
  @ApiProperty({ example: 'b1e2f3a4-5678-90ab-cdef-1234567890ab' })
  userId: string;

  @Expose()
  @ApiProperty({ example: 'D1234567' })
  driverLicenseNumber: string;

  @Expose()
  @ApiProperty({
    description: 'Fecha de expiración de la licencia (ISO 8601)',
    example: '2026-12-31T00:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  driverLicenseExpirationDate: Date;

  @Expose()
  @ApiProperty({
    enum: BackgroundCheckStatus,
    example: BackgroundCheckStatus.APPROVED,
  })
  backgroundCheckStatus: BackgroundCheckStatus;

  @Expose()
  @ApiProperty({ example: true })
  isApproved: boolean;

  @Expose()
  @ApiProperty({ enum: OnboardingStatus, example: OnboardingStatus.REGISTERED })
  onboardingStatus: OnboardingStatus;

  @Expose()
  @ApiPropertyOptional({
    description: 'Última vez que el driver estuvo en línea',
    example: '2025-07-14T18:45:00.000Z',
    type: String,
    format: 'date-time',
  })
  lastOnlineAt?: Date;

  @Expose()
  @ApiProperty({
    description: 'Fecha de creación del registro (ISO 8601)',
    example: '2025-07-01T09:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt: Date;
}
