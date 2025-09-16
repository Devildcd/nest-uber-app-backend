import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { OrderDataDto } from './order-data.dto';

export class CreateOrderResponseDto {
  @ApiProperty({ example: true })
  @Expose()
  success: boolean;

  @ApiProperty({ example: 'Order created successfully' })
  @Expose()
  message: string;

  @ApiPropertyOptional({ type: OrderDataDto })
  @Expose()
  @Type(() => OrderDataDto)
  data?: OrderDataDto;

  @ApiPropertyOptional()
  @Expose()
  error?: { code?: string; details?: any };
}
