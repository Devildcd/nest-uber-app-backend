import { IntersectionType } from '@nestjs/mapped-types';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { VehicleCategoryFiltersDto } from './vehicle-category-filters.dto';

export class VehicleCategoryListQueryDto extends IntersectionType(
  PaginationDto,
  VehicleCategoryFiltersDto,
) {}
