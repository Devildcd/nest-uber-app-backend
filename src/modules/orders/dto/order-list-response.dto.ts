import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';

import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { OrderListItemDto } from './order-list-item.dto';

/**
 * DTO de respuesta para listado paginado de Orders
 */
export class OrderListResponseDto extends ApiResponseDto<OrderListItemDto[]> {
  @Expose()
  @Type(() => OrderListItemDto)
  @ApiProperty({
    type: [OrderListItemDto],
    description: 'Listado de órdenes',
  })
  declare data: OrderListItemDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({
    type: PaginationMetaDto,
    description: 'Metadatos de paginación',
  })
  declare meta: PaginationMetaDto;
}
