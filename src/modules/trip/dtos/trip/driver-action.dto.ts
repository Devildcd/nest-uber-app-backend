import { IsUUID } from 'class-validator';

export class DriverActionDto {
  @IsUUID()
  driverId: string; // o tómalo del JWT; aquí lo pasamos explícito para simplificar
}
