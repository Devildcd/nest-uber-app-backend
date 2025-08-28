import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { VehicleServiceClassesService } from '../services/vehicle-service-classes.service';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { CreateVehicleServiceClassDto } from '../dto/create-vehicle-service-class.dto';
import { CreateVehicleServiceClassResponseDto } from '../dto/create-vehicle-service-class-response.dto';
import { VehicleCategoriesListResponseDto } from 'src/modules/vehicle-category/dto/vehicle-categories-list-response.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { VehicleServiceClassFiltersDto } from '../dto/vehicle-service-class-filter.dto';
import { VehicleServiceClassesListResponseDto } from '../dto/vehicle-service-class-list-response.dto';
import { plainToInstance } from 'class-transformer';
import { VehicleServiceClassResponseWrapperDto } from '../dto/vehicle-service-class-wrapper.dto';
import { UpdateVehicleServiceClassDto } from '../dto/update-vehicle-service-class.dto';

@ApiTags('vehicle-service-class')
@Controller('vehicle-service-classes')
export class VehicleServiceClassesController {
  private readonly logger = new Logger(VehicleServiceClassesController.name);

  constructor(
    private readonly vehicleServiceClassesService: VehicleServiceClassesService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new vehicle service class' })
  @ApiBody({ type: CreateVehicleServiceClassDto })
  @ApiCreatedResponse({
    description: 'Vehicle service class created',
    type: CreateVehicleServiceClassDto,
  })
  @ApiConflictResponse({ description: 'Vehicle service class name conflict' })
  async create(
    @Body() dto: CreateVehicleServiceClassDto,
  ): Promise<CreateVehicleServiceClassResponseDto> {
    this.logger.log(`Creating vehicle service class ${dto.name}`);
    const apiResp = await this.vehicleServiceClassesService.create(dto);

    return apiResp;
  }

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get paginated list of vehicle service classes (admin only)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiOkResponse({
    description: 'Vehicle service classes retrieved',
    type: VehicleCategoriesListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admins only' })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query() filters?: VehicleServiceClassFiltersDto,
  ): Promise<VehicleServiceClassesListResponseDto> {
    this.logger.log(
      `Fetching vehicle service — page ${pagination.page}, limit ${pagination.limit}`,
    );

    const apiResp = await this.vehicleServiceClassesService.findAll(
      pagination,
      filters,
    );
    return plainToInstance(VehicleServiceClassesListResponseDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single vehicle service class by ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the vehicle service class',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Vehicle service class retrieved',
    type: VehicleServiceClassResponseWrapperDto,
  })
  @ApiNotFoundResponse({ description: 'Vehicle service class not found' })
  async findById(
    @Param('id') id: string,
  ): Promise<VehicleServiceClassResponseWrapperDto> {
    this.logger.log(`Fetching vehicle service class by id: ${id}`);

    // El servicio retorna ApiResponse<VehicleServiceClass>
    const apiResp = await this.vehicleServiceClassesService.findById(id);

    // PlainToInstance aplicará @Expose/@Transform del DTO interno
    return plainToInstance(VehicleServiceClassResponseWrapperDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a vehicle service class' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the vehicle service class',
    type: 'string',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateVehicleServiceClassDto })
  @ApiOkResponse({
    description: 'Vehicle service class updated',
    type: VehicleServiceClassResponseWrapperDto, // ← aquí el wrapper
  })
  @ApiNotFoundResponse({ description: 'Vehicle service class not found' })
  @ApiConflictResponse({ description: 'Vehicle service class name conflict' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleServiceClassDto,
  ): Promise<VehicleServiceClassResponseWrapperDto> {
    this.logger.log(`Updating vehicle service class ${id}`);
    const apiResp = await this.vehicleServiceClassesService.update(id, dto);

    return plainToInstance(VehicleServiceClassResponseWrapperDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a vehicle service class' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the vehicle service class',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Vehicle service class deleted',
    type: VehicleServiceClassResponseWrapperDto, // ← aquí el wrapper
  })
  @ApiNotFoundResponse({ description: 'Vehicle service class not found' })
  async remove(
    @Param('id') id: string,
  ): Promise<VehicleServiceClassResponseWrapperDto> {
    this.logger.log(`Deleting vehicle service class ${id}`);

    // El servicio retorna ApiResponse<null>
    const apiResp = await this.vehicleServiceClassesService.remove(id);

    // Si quieres devolver sólo un mensaje sin data, tu wrapper aún lo mostrará:
    return plainToInstance(VehicleServiceClassResponseWrapperDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }
}
