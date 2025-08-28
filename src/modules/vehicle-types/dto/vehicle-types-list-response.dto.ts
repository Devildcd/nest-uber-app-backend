import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';

import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { VehicleTypeListItemDto } from './vehicle-types-list-item.dto';

/**
 * DTO de respuesta para listado paginado de Vehicle Types
 */
export class VehicleTypeListResponseDto extends ApiResponseDto<
  VehicleTypeListItemDto[]
> {
  @Expose()
  @Type(() => VehicleTypeListItemDto)
  @ApiProperty({
    type: [VehicleTypeListItemDto],
    description: 'Listado de tipos de vehículo',
  })
  declare data: VehicleTypeListItemDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({
    type: PaginationMetaDto,
    description: 'Metadatos de paginación',
  })
  declare meta: PaginationMetaDto;
}
