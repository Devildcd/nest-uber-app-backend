import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCashCollectionPointDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

  /**
   * Coordenadas: [longitude, latitude]
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @Transform(({ value }) => {
    if (!value) return null;
    // allow a comma-separated string or actual array
    if (typeof value === 'string') {
      const parts = value.split(',').map((p: string) => Number(p.trim()));
      return [parts[0], parts[1]];
    }
    return value;
  })
  location?: [number, number];

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @IsOptional()
  @IsObject()
  openingHours?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
