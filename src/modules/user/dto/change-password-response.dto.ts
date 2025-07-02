import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';

export class ChangePasswordResponseDto extends ApiResponseDto<null> {
  @Expose()
  @ApiProperty({ required: false, example: null, nullable: true })
  declare data?: null;
}
