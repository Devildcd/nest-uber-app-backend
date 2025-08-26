import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { VehicleCategoryListItemDto } from './vehicle-category-list-item.dto';

export class VehicleCategoryResponseWrapperDto extends ApiResponseDto<VehicleCategoryListItemDto> {
  @Expose()
  @Type(() => VehicleCategoryListItemDto)
  @ApiProperty({
    type: VehicleCategoryListItemDto,
    description: 'Vehicle category data',
  })
  declare data?: VehicleCategoryListItemDto;
}
