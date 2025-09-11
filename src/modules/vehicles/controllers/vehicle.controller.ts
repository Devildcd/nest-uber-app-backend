// src/modules/vehicles/controllers/vehicles.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBody,
  ApiResponse,
  ApiQuery,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiParam,
} from '@nestjs/swagger';
import { VehiclesService } from '../services/vehicles.service';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../dto/update-vehicle.dto';
import { VehicleFilterDto } from '../dto/vehicle-filter.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { VehicleResponseWrapperDto } from '../dto/vehicle-wrapper.dto';
import { VehicleListResponseDto } from '../dto/vehicle-list-item-response.dto';
import { CreateVehicleResponseDto } from '../dto/create-vehicle-response.dto';
import { VehicleResponseDto } from '../dto/vehicle-response.dto';
import { plainToInstance } from 'class-transformer';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { DriverProfileResponseDto } from 'src/modules/driver-profiles/dto/driver-profile-response.dto';
import { DriverProfileResponseWrapperDto } from 'src/modules/driver-profiles/dto/driver-profile-wrapper.dto';

@ApiTags('vehicles')
@Controller('vehicles')
export class VehicleController {
  private readonly logger = new Logger(VehicleController.name);

  constructor(private readonly vehiclesService: VehiclesService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear un nuevo vehículo' })
  @ApiBody({
    type: CreateVehicleDto,
    description: 'Datos del vehículo a crear',
  })
  @ApiResponse({
    description: 'Tipo de vehículo creado exitosamente',
    type: CreateVehicleResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos o violación de reglas de negocio',
  })
  @ApiNotFoundResponse({
    description:
      'Recursos relacionados no encontrados (tipo de vehículo o perfil del conductor)',
  })
  @ApiConflictResponse({
    description: 'Conflicto con datos existentes (placa duplicada)',
  })
  async create(
    @Body() dto: CreateVehicleDto,
  ): Promise<CreateVehicleResponseDto> {
    this.logger.log('create vehicle', dto);
    const apiResponse = await this.vehiclesService.create(dto);
    return apiResponse;
  }

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar vehículos (paginado, con filtros) solo admin',
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiOkResponse({
    description: 'Vehicles retrieved',
    type: VehicleResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admins only' })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query() filters?: VehicleFilterDto,
  ): Promise<VehicleListResponseDto> {
    this.logger.log(
      `Fetching vehicle type — page ${pagination.page}, limit ${pagination.limit}`,
    );
    const apiResponse = await this.vehiclesService.findAll(pagination, filters);
    return plainToInstance(VehicleListResponseDto, apiResponse, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener vehículo por id' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the vehicle',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'vehicle retrieved',
    type: VehicleResponseWrapperDto,
  })
  @ApiNotFoundResponse({ description: 'Vehicle not found' })
  async findById(@Param('id') id: string): Promise<VehicleResponseWrapperDto> {
    this.logger.log(`get vehicle ${id}`);
    const apiResponse = await this.vehiclesService.findById(id);
    return plainToInstance(VehicleResponseWrapperDto, apiResponse, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar vehículo por id (parcial)' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiNotFoundResponse({
    description: 'Vehicle or related resources not found',
  })
  @ApiConflictResponse({ description: 'Conflict (duplicate plate, etc.)' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the vehicle type',
    type: 'string',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateVehicleDto })
  @ApiOkResponse({
    description: 'Vehicle type updated',
    type: VehicleResponseWrapperDto, // ← aquí el wrapper
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<VehicleResponseWrapperDto> {
    this.logger.log(`update vehicle ${id}`, dto);
    const apiResponse = await this.vehiclesService.update(id, dto);
    return plainToInstance(VehicleResponseWrapperDto, apiResponse, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar (soft) vehículo por id' })
  @HttpCode(HttpStatus.OK)
  @ApiNotFoundResponse({ description: 'Vehicle not found' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the vehicle type',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Vehicle type deleted',
    type: VehicleResponseWrapperDto, // ← aquí el wrapper
  })
  async remove(@Param('id') id: string): Promise<VehicleResponseWrapperDto> {
    this.logger.log(`delete vehicle ${id}`);
    const apiResponse = await this.vehiclesService.remove(id);
    return plainToInstance(VehicleResponseWrapperDto, apiResponse, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Get(':id/driver-profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener el driver profile asociado a un vehículo' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the vehicle',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Driver profile retrieved successfully',
    type: DriverProfileResponseWrapperDto,
  })
  @ApiNotFoundResponse({ description: 'Vehicle or driver profile not found' })
  async findDriverProfile(
    @Param('id') id: string,
  ): Promise<DriverProfileResponseWrapperDto> {
    this.logger.log(`Fetching driver profile for vehicle ${id}`);
    const apiResponse =
      await this.vehiclesService.findDriverProfileByVehicleId(id);
    return plainToInstance(DriverProfileResponseWrapperDto, apiResponse, {
      excludeExtraneousValues: true,
    });
  }
}
