// src/modules/transactions/dto/transaction-detail.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TransactionType,
  TransactionStatus,
} from '../entities/transaction.entity';
import { Expose } from 'class-transformer';

export class TransactionDetailDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty({ enum: TransactionType })
  type: TransactionType;

  @Expose()
  @ApiProperty()
  grossAmount: number;

  @Expose()
  @ApiPropertyOptional()
  platformFeeAmount?: number;

  @Expose()
  @ApiProperty()
  netAmount: number;

  @Expose()
  @ApiProperty()
  currency: string;

  @Expose()
  @ApiProperty({ enum: TransactionStatus })
  status: TransactionStatus;

  @Expose()
  @ApiPropertyOptional()
  description?: string;

  @Expose()
  @ApiPropertyOptional()
  processedAt?: string;

  @Expose()
  @ApiPropertyOptional()
  orderId?: string;

  @Expose()
  @ApiPropertyOptional()
  tripId?: string;

  @Expose()
  @ApiPropertyOptional()
  fromUserId?: string;

  @Expose()
  @ApiPropertyOptional()
  fromUserName?: string;

  @Expose()
  @ApiPropertyOptional()
  toUserId?: string;

  @Expose()
  @ApiPropertyOptional()
  toUserName?: string;

  @Expose()
  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, any>;

  @Expose()
  @ApiProperty()
  createdAt: string;

  @Expose()
  @ApiProperty()
  updatedAt: string;

  @Expose()
  @ApiPropertyOptional()
  deletedAt?: string;
}
