import {
  Controller,
  Post,
  Body,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  Logger,
  HttpCode,
  Query,
  Get,
  Param,
  Delete,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiQuery,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiParam,
} from '@nestjs/swagger';
import { VehicleTypesService } from '../services/vehicle-types.service';
import { CreateVehicleTypeDto } from '../dto/create-vehicle-types.dto';
import { VehicleTypeResponseDto } from '../dto/vehicle-types-response.dto';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { CreateVehicleTypeResponseDto } from '../dto/create-vehicle-types-response.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { VehicleTypeFilterDto } from '../dto/vehicle-types-filter.dto';
import { plainToInstance } from 'class-transformer';
import { VehicleTypeListResponseDto } from '../dto/vehicle-types-list-response.dto';
import { VehicleTypeResponseWrapperDto } from '../dto/vehicle-types-wrapper.dto';
import { UpdateVehicleTypeDto } from '../dto/update-vehicle-types.dto';

@ApiTags('vehicle-types')
@Controller('vehicle-types')
export class VehicleTypeController {
  private readonly logger = new Logger(VehicleTypeController.name);
  constructor(private readonly vehicleTypesService: VehicleTypesService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear un nuevo tipo de vehículo' })
  @ApiBody({
    type: CreateVehicleTypeDto,
    description: 'Datos del tipo de vehículo a crear',
  })
  @ApiResponse({
    description: 'Tipo de vehículo creado exitosamente',
    type: CreateVehicleTypeResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos de entrada inválidos o violación de reglas de negocio',
  })
  @ApiNotFoundResponse({
    description:
      'Recursos relacionados no encontrados (categoría o clases de servicio)',
  })
  @ApiConflictResponse({
    description: 'Conflicto con datos existentes (nombre duplicado)',
  })
  async create(
    @Body() createVehicleTypeDto: CreateVehicleTypeDto,
  ): Promise<CreateVehicleTypeResponseDto> {
    this.logger.log('Creando un nuevo tipo de vehículo', createVehicleTypeDto);
    const apiResponse =
      await this.vehicleTypesService.create(createVehicleTypeDto);
    return apiResponse;
  }

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get paginated list of vehicles type (admin only)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiOkResponse({
    description: 'Vehicles type retrieved',
    type: VehicleTypeResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admins only' })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query() filters?: VehicleTypeFilterDto,
  ): Promise<VehicleTypeListResponseDto> {
    this.logger.log(
      `Fetching vehicle type — page ${pagination.page}, limit ${pagination.limit}`,
    );

    const apiResp = await this.vehicleTypesService.findAll(pagination, filters);

    return plainToInstance(VehicleTypeListResponseDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single vehicle type by ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the vehicle type',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'vehicle type retrieved',
    type: VehicleTypeResponseWrapperDto,
  })
  @ApiNotFoundResponse({ description: 'Vehicle type not found' })
  async findById(
    @Param('id') id: string,
  ): Promise<VehicleTypeResponseWrapperDto> {
    this.logger.log(`Fetching vehicle type by id: ${id}`);
    // El servicio retorna ApiResponse<VehicleType>
    const apiResp = await this.vehicleTypesService.findById(id);

    // PlainToInstance aplicará @Expose/@Transform del DTO interno
    return plainToInstance(VehicleTypeResponseWrapperDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a vehicle type' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the vehicle type',
    type: 'string',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateVehicleTypeDto })
  @ApiOkResponse({
    description: 'Vehicle type updated',
    type: VehicleTypeResponseWrapperDto, // ← aquí el wrapper
  })
  @ApiNotFoundResponse({ description: 'Vehicle type not found' })
  @ApiConflictResponse({ description: 'Vehicle type name conflict' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleTypeDto,
  ): Promise<VehicleTypeResponseWrapperDto> {
    this.logger.log(`Updating vehicle type ${id}`);
    const apiResp = await this.vehicleTypesService.update(id, dto);

    return plainToInstance(VehicleTypeResponseWrapperDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a vehicle type' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the vehicle type',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Vehicle type deleted',
    type: VehicleTypeResponseWrapperDto, // ← aquí el wrapper
  })
  @ApiNotFoundResponse({ description: 'Vehicle type not found' })
  async remove(
    @Param('id') id: string,
  ): Promise<VehicleTypeResponseWrapperDto> {
    this.logger.log(`Deleting vehicle type ${id}`);

    // El servicio retorna ApiResponse<null>
    const apiResp = await this.vehicleTypesService.remove(id);

    // Si quieres devolver sólo un mensaje sin data, tu wrapper aún lo mostrará:
    return plainToInstance(VehicleTypeResponseWrapperDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }
}
