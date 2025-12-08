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
import { UserType } from 'src/modules/user/entities/user.entity';

// DTO para login: puede usar email o phoneNumber (al menos uno)
export enum AppAudience {
  DRIVER_APP = 'driver_app',
  PASSENGER_APP = 'passenger_app',
  ADMIN_PANEL = 'admin_panel',
  API_CLIENT = 'api_client',
}

export class LoginDto {
  @ApiProperty({ required: false })
  @ValidateIf((o: LoginDto) => !o.phoneNumber)
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @ValidateIf((o: LoginDto) => !o.email)
  @IsString()
  @Length(7, 20)
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty()
  @IsString()
  @Length(8, 100)
  password: string;

  @ApiProperty({ required: false, enum: SessionType })
  @IsEnum(SessionType)
  @IsOptional()
  sessionType?: SessionType;

  // 👇 Quién me está llamando (para mapear a rol esperado)
  @ApiProperty({ enum: AppAudience })
  @IsEnum(AppAudience)
  appAudience: AppAudience;

  // (Opcional) si quieres que el cliente lo declare explícitamente y validarlo
  @ApiProperty({ required: false, enum: UserType })
  @IsEnum(UserType)
  @IsOptional()
  expectedUserType?: UserType;

  @ApiProperty({ required: false })
  @IsOptional()
  deviceInfo?: {
    os?: string;
    browser?: string;
    model?: string;
    appVersion?: string;
  };

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
  };
}
