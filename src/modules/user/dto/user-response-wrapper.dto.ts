import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { UserResponseDto } from './user-response.dto';

export class UserResponseWrapperDto extends ApiResponseDto<UserResponseDto> {
  @Expose()
  @Type(() => UserResponseDto)
  @ApiProperty({ type: UserResponseDto })
  declare data: UserResponseDto;
}
