import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UnblockDriverWalletDto {
  @ApiPropertyOptional({
    description: 'Motivo del desbloqueo',
    example: 'Disputa resuelta',
  })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Comentario adicional',
    example: 'Se validó identidad del conductor y se cerró el ticket',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
