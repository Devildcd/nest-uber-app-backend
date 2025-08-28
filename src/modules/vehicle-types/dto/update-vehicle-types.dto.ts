import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateVehicleTypeDto } from './create-vehicle-types.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateVehicleTypeDto extends PartialType(CreateVehicleTypeDto) {
  @ApiPropertyOptional({
    description: 'Permite actualizar el nombre del tipo de vehículo',
    example: 'Minivan',
  })
  @IsOptional()
  @IsString()
  name?: string;
}
