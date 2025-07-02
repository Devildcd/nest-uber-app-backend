// src/modules/auth/dto/change-password.dto.ts
import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Match } from '../../../common/validators/match.decorator';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from '../../../common/utils/constants';

export class ChangePasswordDto {
  @ApiProperty({
    description: `New password (min ${PASSWORD_MIN_LENGTH} chars)`,
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    example: 'N3wP@ssw0rd!',
  })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  newPassword: string;

  @ApiProperty({
    description: 'Repeat the new password for confirmation',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    example: 'N3wP@ssw0rd!',
  })
  @IsString()
  @Match('newPassword', { message: 'confirmPassword must match newPassword' })
  confirmPassword: string;
}
