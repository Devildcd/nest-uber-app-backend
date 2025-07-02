import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { CreateAuthCredentialsDto } from './create-auth-credentials.dto';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterUserDto {
  @ApiProperty({ type: CreateUserDto, description: 'User profile data' })
  @ValidateNested()
  @Type(() => CreateUserDto)
  user: CreateUserDto;

  @ApiProperty({
    type: CreateAuthCredentialsDto,
    description: 'Authentication credentials data',
  })
  @ValidateNested()
  @Type(() => CreateAuthCredentialsDto)
  credentials: CreateAuthCredentialsDto;
}
