import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';

import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { VehicleCategoryListItemDto } from './vehicle-category-list-item.dto';

/**
 * DTO de respuesta para listado paginado de Vehicle Categories
 */
export class VehicleCategoriesListResponseDto extends ApiResponseDto<
  VehicleCategoryListItemDto[]
> {
  @Expose()
  @Type(() => VehicleCategoryListItemDto)
  @ApiProperty({
    type: [VehicleCategoryListItemDto],
    description: 'Listado de categorías de vehículos',
  })
  declare data: VehicleCategoryListItemDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({
    type: PaginationMetaDto,
    description: 'Metadatos de paginación',
  })
  declare meta: PaginationMetaDto;
}
