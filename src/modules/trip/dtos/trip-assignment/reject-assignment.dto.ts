import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectAssignmentDto {
  @ApiPropertyOptional({
    description: 'Motivo del rechazo',
    example: 'Muy lejos',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
