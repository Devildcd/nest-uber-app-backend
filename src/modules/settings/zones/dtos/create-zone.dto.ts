import { Transform as CTransform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsGeoJsonMultiPolygon } from 'src/common/validators/is-geojson-multipolygon.decorator';

export class CreateZoneDto {
  @IsUUID()
  cityId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @CTransform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @CTransform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  kind?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  priority?: number;

  // NOT NULL en DB => requerido en create
  @IsGeoJsonMultiPolygon({
    message: 'geom must be a valid GeoJSON MultiPolygon',
  })
  geom!: any;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
