import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    description: 'Full name',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    format: 'email',
    maxLength: 150,
  })
  @IsOptional()
  @IsEmail()
  @Length(5, 150)
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+34123456789' })
  @IsOptional()
  @IsString()
  @Length(10, 20)
  phoneNumber?: string;
}
