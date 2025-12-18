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
import { VehicleCategoryService } from '../services/vehicle-category.service';
import { CreateVehicleCategoryDto } from '../dto/create-vehicle-category.dto';
import { plainToInstance } from 'class-transformer';
import { CreateVehicleCategoryResponseDto } from '../dto/create-vehicle-category-response.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { VehicleCategoryFiltersDto } from '../dto/vehicle-category-filters.dto';
import { VehicleCategoriesListResponseDto } from '../dto/vehicle-categories-list-response.dto';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { UpdateVehicleCategoryDto } from '../dto/update-vehicle-category.dto';
import { VehicleCategoryResponseWrapperDto } from '../dto/vehicle-category-wrapper.dto';
import { VehicleCategoryListQueryDto } from '../dto/vehicle-category-list-query.dto';

@ApiTags('vehicle-category')
@Controller('vehicle-categories')
export class VehicleCategoryController {
  private readonly logger = new Logger(VehicleCategoryController.name);

  constructor(
    private readonly vehicleCategoryService: VehicleCategoryService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new vehicle category' })
  @ApiBody({ type: CreateVehicleCategoryDto })
  @ApiCreatedResponse({
    description: 'Vehicle category created',
    type: CreateVehicleCategoryDto,
  })
  @ApiConflictResponse({ description: 'Vehicle category name conflict' })
  async create(
    @Body() dto: CreateVehicleCategoryDto,
  ): Promise<CreateVehicleCategoryResponseDto> {
    this.logger.log(`Creating vehicle category ${dto.name}`);
    const apiResp = await this.vehicleCategoryService.create(dto);

    return apiResp;
  }

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get paginated list of vehicle categories (admin only)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiOkResponse({
    description: 'Vehicle categories retrieved',
    type: VehicleCategoriesListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admins only' })
  async findAll(
    @Query() query: VehicleCategoryListQueryDto,
  ): Promise<VehicleCategoriesListResponseDto> {
    const { page, limit, name, isActive } = query;

    const pagination: PaginationDto = {
      page,
      limit,
    };

    const filters: VehicleCategoryFiltersDto = {
      name,
      isActive,
    };

    this.logger.log(
      `Fetching vehicle categories — page ${pagination.page}, limit ${pagination.limit}, name=${name}, isActive=${isActive}`,
    );

    const apiResp = await this.vehicleCategoryService.findAll(
      pagination,
      filters,
    );

    return plainToInstance(VehicleCategoriesListResponseDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single vehicle category by ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the vehicle category',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Vehicle category retrieved',
    type: VehicleCategoryResponseWrapperDto,
  })
  @ApiNotFoundResponse({ description: 'Vehicle category not found' })
  async findById(
    @Param('id') id: string,
  ): Promise<VehicleCategoryResponseWrapperDto> {
    this.logger.log(`Fetching vehicle category by id: ${id}`);

    // El servicio retorna ApiResponse<VehicleCategory>
    const apiResp = await this.vehicleCategoryService.findById(id);

    // PlainToInstance aplicará @Expose/@Transform del DTO interno
    return plainToInstance(VehicleCategoryResponseWrapperDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a vehicle category' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the vehicle category',
    type: 'string',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateVehicleCategoryDto })
  @ApiOkResponse({
    description: 'Vehicle category updated',
    type: VehicleCategoryResponseWrapperDto, // ← aquí el wrapper
  })
  @ApiNotFoundResponse({ description: 'Vehicle category not found' })
  @ApiConflictResponse({ description: 'Vehicle category name conflict' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleCategoryDto,
  ): Promise<VehicleCategoryResponseWrapperDto> {
    this.logger.log(`Updating vehicle category ${id}`);
    const apiResp = await this.vehicleCategoryService.update(id, dto);

    return plainToInstance(VehicleCategoryResponseWrapperDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a vehicle category' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the vehicle category',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Vehicle category deleted',
    type: VehicleCategoryResponseWrapperDto, // ← aquí el wrapper
  })
  @ApiNotFoundResponse({ description: 'Vehicle category not found' })
  async remove(
    @Param('id') id: string,
  ): Promise<VehicleCategoryResponseWrapperDto> {
    this.logger.log(`Deleting vehicle category ${id}`);

    // El servicio retorna ApiResponse<null>
    const apiResp = await this.vehicleCategoryService.remove(id);

    // Si quieres devolver sólo un mensaje sin data, tu wrapper aún lo mostrará:
    return plainToInstance(VehicleCategoryResponseWrapperDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }
}
