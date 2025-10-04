import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ConfirmCashTopupDto {
  @ApiPropertyOptional({
    description: 'Comentario opcional al confirmar',
    example: 'Billetes verificados y contados',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  comment?: string;
}
