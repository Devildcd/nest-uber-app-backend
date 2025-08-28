import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';

import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { VehicleServiceClassListItemDto } from './vehicle-service-class-list-item.dto';

/**
 * DTO de respuesta para listado paginado de Vehicle Service Classes
 */
export class VehicleServiceClassesListResponseDto extends ApiResponseDto<
  VehicleServiceClassListItemDto[]
> {
  @Expose()
  @Type(() => VehicleServiceClassListItemDto)
  @ApiProperty({
    type: [VehicleServiceClassListItemDto],
    description: 'Listado de clases de servicio de vehículos',
  })
  declare data: VehicleServiceClassListItemDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({
    type: PaginationMetaDto,
    description: 'Metadatos de paginación',
  })
  declare meta: PaginationMetaDto;
}
