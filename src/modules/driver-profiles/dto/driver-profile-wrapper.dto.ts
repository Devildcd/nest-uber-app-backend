import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { DriverProfileResponseDto } from './driver-profile-response.dto';

export class DriverProfileResponseWrapperDto extends ApiResponseDto<DriverProfileResponseDto> {
  @Expose()
  @Type(() => DriverProfileResponseDto)
  @ApiProperty({
    type: DriverProfileResponseDto,
    description: 'Driver profile data',
  })
  declare data?: DriverProfileResponseDto;
}
