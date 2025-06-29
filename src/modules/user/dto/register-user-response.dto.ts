import { ApiProperty } from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { UserResponseDto } from './user-response.dto';
import { Expose, Type } from 'class-transformer';

export class RegisterUserResponseDto extends ApiResponseDto<UserResponseDto> {
  @Expose()
  @Type(() => UserResponseDto)
  @ApiProperty({ type: UserResponseDto })
  declare data: UserResponseDto;
}
