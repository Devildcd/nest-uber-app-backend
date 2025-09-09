import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';

import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { VehicleListItemDto } from './vehicle-list-item.dto';

/**
 * DTO de respuesta para listado paginado de Vehicles
 */
export class VehicleListResponseDto extends ApiResponseDto<
  VehicleListItemDto[]
> {
  @Expose()
  @Type(() => VehicleListItemDto)
  @ApiProperty({
    type: [VehicleListItemDto],
    description: 'Listado de vehículos',
  })
  declare data: VehicleListItemDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({
    type: PaginationMetaDto,
    description: 'Metadatos de paginación',
  })
  declare meta: PaginationMetaDto;
}
