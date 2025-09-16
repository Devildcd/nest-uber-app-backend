import { IsUUID } from 'class-validator';

export class DriverAvailabilityIdParamDto {
  @IsUUID()
  id!: string; // corresponde a drivers_availability._id
}
