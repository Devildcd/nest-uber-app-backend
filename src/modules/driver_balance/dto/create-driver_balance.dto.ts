import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, isUUID, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateDriverBalanceDto {
  @ApiProperty({
    description: 'ID del driver al que se le asigna el wallet',
    example: 'a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6',
  })
  @IsUUID()
  driverId: string;

  @ApiPropertyOptional({
    description: 'Moneda del wallet (ISO 4217 de 3 letras). Default: CUP',
    example: 'CUP',
    default: 'CUP',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  currency?: string = 'CUP';
}
