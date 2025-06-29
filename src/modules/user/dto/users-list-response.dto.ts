import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { UserListItemDto } from './user-list-item.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';

export class UsersListResponseDto extends ApiResponseDto<UserListItemDto[]> {
  @Expose()
  @Type(() => UserListItemDto)
  @ApiProperty({ type: [UserListItemDto] })
  declare data: UserListItemDto[];

  @Expose()
  @Type(() => PaginationMetaDto)
  @ApiProperty({ type: PaginationMetaDto })
  declare meta: PaginationMetaDto;
}
