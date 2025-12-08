// dto/estimate-trip.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GeoPointDto } from 'src/common/dto/geo-point.dto';

export class EstimateTripDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  vehicleCategoryId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  serviceClassId: string;

  @ApiProperty({ type: GeoPointDto })
  @ValidateNested()
  @Type(() => GeoPointDto)
  pickup: GeoPointDto;

  @ApiProperty({ type: [GeoPointDto] })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GeoPointDto)
  stops: GeoPointDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string; // 'CUP' | 'USD'
}
