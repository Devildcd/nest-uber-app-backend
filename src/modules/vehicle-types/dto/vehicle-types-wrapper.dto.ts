import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { VehicleTypeListItemDto } from './vehicle-types-list-item.dto';

export class VehicleTypeResponseWrapperDto extends ApiResponseDto<VehicleTypeListItemDto> {
  @Expose()
  @Type(() => VehicleTypeListItemDto)
  @ApiProperty({
    type: VehicleTypeListItemDto,
    description: 'Vehicle type data',
  })
  declare data?: VehicleTypeListItemDto;
}
