import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { VehicleListItemDto } from './vehicle-list-item.dto';

export class VehicleResponseWrapperDto extends ApiResponseDto<VehicleListItemDto> {
  @Expose()
  @Type(() => VehicleListItemDto)
  @ApiProperty({
    type: VehicleListItemDto,
    description: 'Vehicle data',
  })
  declare data?: VehicleListItemDto;
}
