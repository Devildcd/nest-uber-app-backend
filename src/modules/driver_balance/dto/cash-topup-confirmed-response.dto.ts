import { ApiProperty } from '@nestjs/swagger';

export class CashTopupConfirmedResponseDto {
  @ApiProperty() cashCollectionRecordId: string;
  @ApiProperty() transactionId: string;
  @ApiProperty({ example: 'completed' }) status: 'completed';
  @ApiProperty({ example: 'CUP' }) currency: string;
  @ApiProperty({ example: '150.00' }) amount: string;
  @ApiProperty({ example: '100.00' }) previousBalance: string;
  @ApiProperty({ example: '250.00' }) newBalance: string;
}
