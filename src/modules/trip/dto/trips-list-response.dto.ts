import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TripResponseDto } from './trip-response.dto';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';

export class TripsListResponseDto extends ApiResponseDto<
  TripResponseDto[],
  PaginationMetaDto
> {
  @ApiProperty({ type: [TripResponseDto] })
  @Type(() => TripResponseDto)
  declare data: TripResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  @Type(() => PaginationMetaDto)
  declare meta: PaginationMetaDto;
}