import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { ZoneService } from '../services/zone.service';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { ZonesQueryDto } from '../dtos/zones-query.dto';
import { ZoneListItemDto, ZoneResponseDto } from '../dtos/zone-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { CreateZoneDto } from '../dtos/create-zone.dto';
import { SetActiveDto } from '../../cities/dtos/set-active.dto';
import { UpdateZoneDto } from '../dtos/update-zone.dto';

@ApiTags('zones')
@Controller('zones')
export class ZoneController {
  constructor(private readonly zoneService: ZoneService) {}

  /** Listado paginado */
  @Public()
  @Get()
  @ApiOkResponse({
    description: 'Zones list with pagination',
    type: ApiResponseDto,
  })
  list(
    @Query() q: ZonesQueryDto,
  ): Promise<ApiResponseDto<ZoneListItemDto[], PaginationMetaDto>> {
    return this.zoneService.findAll(q);
  }

  /** Detalle puntual */
  @Public()
  @Get(':id')
  @ApiOkResponse({ type: ApiResponseDto })
  getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponseDto<ZoneResponseDto>> {
    return this.zoneService.getById(id);
  }

  /** Crear zona */
  @Public()
  @Post()
  @ApiOperation({ summary: 'Create zone' })
  @ApiBody({ type: CreateZoneDto })
  @ApiCreatedResponse({
    description: 'Zone created',
    type: ApiResponseDto,
  })
  @ApiConflictResponse({
    description: 'Zone already exists in this city (cityId + name)',
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  create(@Body() dto: CreateZoneDto): Promise<ApiResponseDto<ZoneResponseDto>> {
    return this.zoneService.create(dto);
  }

  /** Patch/Update */
  @Public()
  @Patch(':id')
  @ApiOperation({ summary: 'Update zone (partial)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateZoneDto })
  @ApiOkResponse({
    description: 'Zone updated',
    type: ApiResponseDto,
  })
  @ApiConflictResponse({
    description: 'Another zone with that name already exists in this city',
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateZoneDto,
  ): Promise<ApiResponseDto<ZoneResponseDto>> {
    return this.zoneService.update(id, dto);
  }

  /** Activar / desactivar */
  @Patch(':id/active')
  @ApiOperation({ summary: 'Activate/deactivate zone' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: SetActiveDto })
  @ApiOkResponse({
    description: 'Zone active state updated',
    type: ApiResponseDto,
  })
  setActive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetActiveDto,
  ): Promise<ApiResponseDto<ZoneResponseDto>> {
    return this.zoneService.setActive(id, dto.active);
  }

  /**
   * Resolver mejor zona por punto dentro de una ciudad
   * GET /zones/resolve/by-point?cityId=...&lat=...&lng=...
   */
  @Public()
  @Get('resolve/by-point')
  @ApiOperation({ summary: 'Resolve best zone by point (cityId, lat, lng)' })
  @ApiOkResponse({ type: ApiResponseDto })
  resolveBestByPoint(
    @Query('cityId') cityId: string,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ): Promise<ApiResponseDto<ZoneListItemDto | null>> {
    const latN = Number(lat);
    const lngN = Number(lng);

    return this.zoneService.resolveBestZoneByPoint(cityId, {
      lat: latN,
      lng: lngN,
    });
  }
}
