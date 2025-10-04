import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AcceptAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  assignmentId: string;
}
