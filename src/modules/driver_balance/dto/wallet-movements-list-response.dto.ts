// src/modules/driver_balance/dto/wallet-movements-list-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { WalletMovementDto } from './wallet-movements.dto';

class ListMetaDto {
  @ApiProperty({ example: 42 })
  @Expose()
  total: number;

  @ApiProperty({ example: 1 })
  @Expose()
  page: number;

  @ApiProperty({ example: 10 })
  @Expose()
  limit: number;
}

export class WalletMovementsListResponseDto {
  @ApiProperty({ example: true })
  @Expose()
  success: boolean;

  @ApiProperty({ example: 'Wallet movements retrieved successfully' })
  @Expose()
  message: string;

  @ApiProperty({ type: [WalletMovementDto] })
  @Expose()
  @Type(() => WalletMovementDto)
  data: WalletMovementDto[];

  @ApiProperty({ type: ListMetaDto })
  @Expose()
  @Type(() => ListMetaDto)
  meta: ListMetaDto;
}
