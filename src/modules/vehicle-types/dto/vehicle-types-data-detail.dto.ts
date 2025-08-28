import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { VehicleTypeDataDto } from './vehicle-types-data.dto';
import { VehicleCategoryDataDto } from '../../vehicle-category/dto/vehicle-category-data.dto';
import { VehicleServiceClassDataDto } from '../../vehicle-service-classes/dto/vehicle-service-class-data.dto';

export class VehicleTypeDetailDto extends VehicleTypeDataDto {
  @ApiProperty({
    description: 'Categoría general del tipo de vehículo',
    type: () => VehicleCategoryDataDto,
  })
  @Expose()
  @Type(() => VehicleCategoryDataDto)
  category: VehicleCategoryDataDto;

  @ApiProperty({
    description: 'Clases de servicio asociadas a este tipo de vehículo',
    type: () => [VehicleServiceClassDataDto],
  })
  @Expose()
  @Type(() => VehicleServiceClassDataDto)
  serviceClasses: VehicleServiceClassDataDto[];
}
