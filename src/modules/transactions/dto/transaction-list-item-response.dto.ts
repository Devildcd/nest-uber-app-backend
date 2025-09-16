import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { TransactionListItemDto } from './transaction-list-item.dto';

/**
 * DTO de respuesta para listado paginado de Transactions
 */
export class TransactionListResponseDto extends ApiResponseDto<
  TransactionListItemDto[]
> {
  @Expose()
  @Type(() => TransactionListItemDto)
  @ApiProperty({
    type: [TransactionListItemDto],
    description: 'Listado de transacciones',
  })
  declare data: TransactionListItemDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({
    type: PaginationMetaDto,
    description: 'Metadatos de paginación',
  })
  declare meta: PaginationMetaDto;
}
