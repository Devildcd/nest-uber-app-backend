import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsGeoJsonMultiPolygon } from 'src/common/validators/is-geojson-multipolygon.decorator';
import { IsIanaTimezone } from 'src/common/validators/is-iana-timezone.decorator';
import { Transform as CTransform } from 'class-transformer';

export class CreateCityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @CTransform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, {
    message: 'countryCode must be ISO-3166-1 alpha-2 (e.g., MX, CO)',
  })
  @CTransform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  countryCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @IsIanaTimezone({
    message:
      'timezone must be a valid IANA timezone (e.g., America/Mexico_City)',
  })
  timezone!: string;

  /** GeoJSON MultiPolygon (opcional) */
  @IsOptional()
  @IsGeoJsonMultiPolygon({
    message: 'geom must be a valid GeoJSON MultiPolygon',
  })
  geom?: any | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
