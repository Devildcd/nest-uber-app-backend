// src/common/dto/pagination-meta.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class PaginationMetaDto {
  @Expose()
  @ApiProperty({ example: 42, description: 'Total number of items' })
  total: number;

  @Expose()
  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @Expose()
  @ApiProperty({ example: 10, description: 'Items per page limit' })
  limit: number;

  @ApiProperty() pageCount!: number;
  @ApiProperty() hasNext: boolean;
  @ApiProperty() hasPrev: boolean;
  @ApiProperty({ required: false, nullable: true }) nextPage?: number | null;
  @ApiProperty({ required: false, nullable: true }) prevPage?: number | null;
}
