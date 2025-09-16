import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmCashTopupDto {
  @ApiPropertyOptional({
    description: 'Comentario opcional al confirmar',
    example: 'Billetes verificados y contados',
  })
  comment?: string;
}
