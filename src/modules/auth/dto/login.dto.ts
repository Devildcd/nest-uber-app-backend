import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';
import { SessionType } from '../entities/session.entity';

// DTO para login: puede usar email o phoneNumber (al menos uno)
export class LoginDto {
  @ApiProperty({ description: 'Email del usuario', required: false })
  @ValidateIf((o: LoginDto) => !o.phoneNumber)
  @IsEmail({}, { message: 'El email debe ser válido' })
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Número de teléfono del usuario',
    required: false,
  })
  @ValidateIf((o: LoginDto) => !o.email)
  @IsString({ message: 'El número de teléfono debe ser una cadena' })
  @Length(7, 20, { message: 'El teléfono debe tener entre 7 y 20 caracteres' })
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({ description: 'Contraseña del usuario' })
  @IsString({ message: 'La contraseña debe ser una cadena' })
  @Length(8, 100, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password: string;

  @ApiProperty({
    description: 'Tipo de sesión (web, mobile_app, admin_panel, api_client)',
    enum: SessionType,
    required: false,
  })
  @IsEnum(SessionType, { message: 'Tipo de sesión inválido' })
  @IsOptional()
  sessionType?: SessionType;

  @ApiProperty({ description: 'Información del dispositivo', required: false })
  @IsOptional()
  deviceInfo?: {
    os?: string;
    browser?: string;
    model?: string;
    appVersion?: string;
  };

  @ApiProperty({ description: 'Dirección IP del cliente', required: false })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({ description: 'User-Agent del cliente', required: false })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({ description: 'Ubicación geográfica', required: false })
  @IsOptional()
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
  };
}
