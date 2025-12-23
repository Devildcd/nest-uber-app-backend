import { IsUUID } from 'class-validator';

export class ZoneIdParamDto {
  @IsUUID()
  id!: string;
}
