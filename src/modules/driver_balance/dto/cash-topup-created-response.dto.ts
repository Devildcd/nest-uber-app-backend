import { ApiProperty } from '@nestjs/swagger';

export class CashTopupCreatedResponseDto {
  @ApiProperty() cashCollectionRecordId: string;
  @ApiProperty() transactionId: string;
  @ApiProperty({ example: 'pending' }) status: 'pending' | 'completed';
  @ApiProperty({ example: 'CUP' }) currency: string;
  @ApiProperty({ example: '150.00' }) amount: string;
  @ApiProperty({ example: '0c7f1042-8631-4dbb-9a21-4c73d1a7b9fa' })
  collectionPointId: string;
  @ApiProperty({ example: '8a8f0f2a-7b2b-4d3a-9f6e-2f5a7d1e9b1c' })
  collectedByUserId: string;
}
