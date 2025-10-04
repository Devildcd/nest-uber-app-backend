import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ConfirmCashOrderDto {
  commissionAmount(commissionAmount: any) {
    throw new Error('Method not implemented.');
  }
  @ApiProperty({
    description: 'UUID del usuario que confirma el cobro (staff/operador)',
    example: '7a0532d5-6b93-4eab-9b3d-6c2203e1f0d2',
  })
  @IsUUID('4')
  confirmedByUserId: string;
}
