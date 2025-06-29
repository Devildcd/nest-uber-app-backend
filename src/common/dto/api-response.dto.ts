import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class PaginationMetaDto {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}

export class ApiResponseDto<T> {
  @Expose()
  @ApiProperty({ example: true })
  success: boolean;

  @Expose()
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;

  @Expose()
  @ApiPropertyOptional({ description: 'Payload data' })
  data?: T;

  @Expose()
  @ApiPropertyOptional({ description: 'Error information if any' })
  error?: {
    code?: string;
    details?: any;
  };

  @Expose()
  @ApiPropertyOptional({
    description: 'Pagination metadata',
    type: () => Object,
  })
  meta?: any;
}
