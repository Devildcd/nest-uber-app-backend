import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';

import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { DriverProfileListItemDto } from './driver-profile-list-item.dto';

export class DriverProfilesListResponseDto extends ApiResponseDto<
  DriverProfileListItemDto[]
> {
  @Expose()
  @Type(() => DriverProfileListItemDto)
  @ApiProperty({
    type: [DriverProfileListItemDto],
    description: 'Listado de driver profiles',
  })
  declare data: DriverProfileListItemDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({
    type: PaginationMetaDto,
    description: 'Metadatos de paginación',
  })
  declare meta: PaginationMetaDto;
}
