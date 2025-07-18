import {
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EmergencyContactDto } from './emergency-contact.dto';

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
}
