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

import { CityService } from '../services/city.service';
import { CreateCityDto } from '../dtos/create-city.dto';
import { UpdateCityDto } from '../dtos/update-city.dto';
import { CitiesQueryDto } from '../dtos/cities-query.dto';
import { SetActiveDto } from '../dtos/set-active.dto';

import { CityListItemDto, CityResponseDto } from '../dtos/city-response.dto';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';

@ApiTags('cities')
@Controller('cities')
export class CityController {
  constructor(private readonly cityService: CityService) {}

  /** Listado paginado */
  @Public()
  @Get()
  @ApiOkResponse({
    description: 'Cities list with pagination',
    type: ApiResponseDto,
  })
  list(
    @Query() q: CitiesQueryDto,
  ): Promise<ApiResponseDto<CityListItemDto[], PaginationMetaDto>> {
    return this.cityService.findAll(q);
  }

  /** Detalle puntual */
  @Public()
  @Get(':id')
  @ApiOkResponse({ type: ApiResponseDto })
  getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponseDto<CityResponseDto>> {
    return this.cityService.getById(id);
  }

  /** Crear ciudad */
  @Public()
  @Post()
  @ApiOperation({ summary: 'Create city' })
  @ApiBody({ type: CreateCityDto })
  @ApiCreatedResponse({
    description: 'City created',
    type: ApiResponseDto,
  })
  @ApiConflictResponse({
    description: 'City already exists (name + countryCode)',
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  create(@Body() dto: CreateCityDto): Promise<ApiResponseDto<CityResponseDto>> {
    return this.cityService.create(dto);
  }

  /** Patch/Update */
  @Public()
  @Patch(':id')
  @ApiOperation({ summary: 'Update city (partial)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateCityDto })
  @ApiOkResponse({
    description: 'City updated',
    type: ApiResponseDto,
  })
  @ApiConflictResponse({
    description: 'Another city already exists (name + countryCode)',
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCityDto,
  ): Promise<ApiResponseDto<CityResponseDto>> {
    return this.cityService.update(id, dto);
  }

  /** Activar / desactivar */
  @Patch(':id/active')
  @ApiOperation({ summary: 'Activate/deactivate city' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: SetActiveDto })
  @ApiOkResponse({
    description: 'City active state updated',
    type: ApiResponseDto,
  })
  setActive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetActiveDto,
  ): Promise<ApiResponseDto<CityResponseDto>> {
    return this.cityService.setActive(id, dto.active);
  }

  /**
   * Resolver ciudad por punto
   * GET /cities/resolve?lat=..&lng=..
   *
   * Nota: aquí NO uso decoradores custom porque no los creamos para query,
   * lo dejamos simple y validas en DTO si quieres. Si ya tienes ParseFloatPipe custom, úsalo.
   */
  @Public()
  @Get('resolve/by-point')
  @ApiOperation({ summary: 'Resolve city by point (lat,lng)' })
  @ApiOkResponse({ type: ApiResponseDto })
  resolveByPoint(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ): Promise<ApiResponseDto<CityListItemDto | null>> {
    const latN = Number(lat);
    const lngN = Number(lng);
    // si quieres, aquí puedes tirar BadRequestException si NaN
    return this.cityService.resolveByPoint({ lat: latN, lng: lngN });
  }
}
