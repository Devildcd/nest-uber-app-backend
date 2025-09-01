import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { VehicleServiceClassListItemDto } from './vehicle-service-class-list-item.dto';

export class VehicleServiceClassResponseWrapperDto extends ApiResponseDto<VehicleServiceClassListItemDto> {
  @Expose()
  @Type(() => VehicleServiceClassListItemDto)
  @ApiProperty({
    type: VehicleServiceClassListItemDto,
    description: 'Vehicle service class data',
  })
  declare data?: VehicleServiceClassListItemDto;
}
