import { IsUUID } from 'class-validator';

export class IdParamDto {
  @IsUUID()
  id!: string; // corresponde a trips._id
}