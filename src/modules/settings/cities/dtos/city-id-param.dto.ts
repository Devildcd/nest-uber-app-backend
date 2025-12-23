import { IsUUID } from 'class-validator';

export class CityIdParamDto {
  @IsUUID()
  id!: string;
}
