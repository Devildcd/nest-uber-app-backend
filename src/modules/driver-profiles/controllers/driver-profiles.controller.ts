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
import { DriverProfileService } from '../services/driver-profile.service';
import { CreateDriverProfileDto } from '../dto/create-driver-profile.dto';
import { plainToInstance } from 'class-transformer';
import { CreateDriverProfileResponseDto } from '../dto/create-driver-profile-response.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { DriverProfileFiltersDto } from '../dto/driver-profile-filters.dto';
import { DriverProfilesListResponseDto } from '../dto/driver-profile-list-response.dto';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { UpdateDriverProfileDto } from '../dto/update-driver-profile.dto';
import { DriverProfileResponseWrapperDto } from '../dto/driver-profile-wrapper.dto';

@ApiTags('drivers')
@Controller('drivers')
export class DriverProfileController {
  private readonly logger = new Logger(DriverProfileController.name);

  constructor(private readonly driverProfileService: DriverProfileService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new driver profile' })
  @ApiBody({ type: CreateDriverProfileDto })
  @ApiCreatedResponse({
    description: 'Driver profile created',
    type: CreateDriverProfileResponseDto,
  })
  @ApiConflictResponse({ description: 'Driver license number conflict' })
  async create(
    @Body() dto: CreateDriverProfileDto,
  ): Promise<CreateDriverProfileResponseDto> {
    this.logger.log(`Creating driver profile for user: ${dto.userId}`);

    const apiResp = await this.driverProfileService.create(dto);
    return apiResp;
  }

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get paginated list of driver profiles (admin only)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiOkResponse({
    description: 'Driver profiles retrieved',
    type: DriverProfilesListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admins only' })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query() filters?: DriverProfileFiltersDto,
  ): Promise<DriverProfilesListResponseDto> {
    this.logger.log(
      `Fetching driver profiles — page ${pagination.page}, limit ${pagination.limit}`,
    );

    const apiResp = await this.driverProfileService.findAll(
      pagination,
      filters,
    );

    return plainToInstance(DriverProfilesListResponseDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single driver profile by ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the driver profile',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Driver profile retrieved',
    type: DriverProfileResponseWrapperDto,
  })
  @ApiNotFoundResponse({ description: 'Driver profile not found' })
  async findById(
    @Param('id') id: string,
  ): Promise<DriverProfileResponseWrapperDto> {
    this.logger.log(`Fetching driver profile by id: ${id}`);

    // El servicio retorna ApiResponse<DriverProfile>
    const apiResp = await this.driverProfileService.findById(id);

    // PlainToInstance aplicará @Expose/@Transform del DTO interno
    return plainToInstance(DriverProfileResponseWrapperDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a driver profile' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the driver profile',
    type: 'string',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateDriverProfileDto })
  @ApiOkResponse({
    description: 'Driver profile updated',
    type: DriverProfileResponseWrapperDto, // ← aquí el wrapper
  })
  @ApiNotFoundResponse({ description: 'Driver profile not found' })
  @ApiConflictResponse({ description: 'Driver license number conflict' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDriverProfileDto,
  ): Promise<DriverProfileResponseWrapperDto> {
    this.logger.log(`Updating driver profile ${id}`);
    const apiResp = await this.driverProfileService.update(id, dto);

    return plainToInstance(DriverProfileResponseWrapperDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }

  @Public()
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a driver profile' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the driver profile',
    type: 'string',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Driver profile deleted',
    type: DriverProfileResponseWrapperDto, // ← aquí el wrapper
  })
  @ApiNotFoundResponse({ description: 'Driver profile not found' })
  async remove(
    @Param('id') id: string,
  ): Promise<DriverProfileResponseWrapperDto> {
    this.logger.log(`Deleting driver profile ${id}`);

    // El servicio retorna ApiResponse<null>
    const apiResp = await this.driverProfileService.remove(id);

    // Si quieres devolver sólo un mensaje sin data, tu wrapper aún lo mostrará:
    return plainToInstance(DriverProfileResponseWrapperDto, apiResp, {
      excludeExtraneousValues: true,
    });
  }
}
