import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BlockDriverWalletDto {
  @ApiPropertyOptional({
    description: 'Motivo del bloqueo (auditoría / trazabilidad)',
    example: 'Sospecha de fraude en transacción',
  })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Comentario adicional',
    example: 'Bloqueo preventivo hasta resolver disputa #D-1234',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
