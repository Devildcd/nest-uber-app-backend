import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class StartAssigningDto {
  @ApiPropertyOptional({
    description: 'Radio de búsqueda en metros para el matching inicial',
    minimum: 100,
    maximum: 100000,
    default: 3000,
  })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(100000)
  searchRadiusMeters?: number = 3000;

  @ApiPropertyOptional({
    description: 'Cantidad máxima de candidatos por “batch” de oferta',
    minimum: 1,
    maximum: 50,
    default: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxCandidates?: number = 5;

  @ApiPropertyOptional({
    description: 'TTL de cada oferta en segundos',
    minimum: 5,
    maximum: 120,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  offerTtlSeconds?: number = 20;
}
