import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/**
 * Información de contacto de emergencia para un driver
 */
export class EmergencyContactDto {
  @ApiProperty({
    description: 'Nombre completo del contacto de emergencia',
    example: 'María Pérez',
  })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({
    description: 'Número de teléfono del contacto de emergencia',
    example: '+52 55 1234 5678',
  })
  @IsString()
  @Length(7, 20)
  phoneNumber: string;

  @ApiProperty({
    description: 'Relación del contacto con el driver',
    example: 'Hermana',
  })
  @IsString()
  @Length(1, 50)
  relationship: string;
}
