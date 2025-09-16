// src/modules/drivers/controllers/driver-availability.controller.ts
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DriverAvailabilityService } from '../services/driver-availability.service';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { DriverAvailabilityQueryDto } from '../dtos/driver-availability-query.dto';
import { DriverAvailabilityResponseDto } from '../dtos/driver-availability-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { CreateDriverAvailabilityDto } from '../dtos/create-driver-availability.dto';

@ApiTags('driver-availability')
@Controller('driver-availability')
export class DriverAvailabilityController {
  constructor(
    private readonly driverAvailabilityService: DriverAvailabilityService,
  ) {}

  @Public()
  @Get()
  @ApiOkResponse({
    description: 'Driver availability list with pagination',
    type: ApiResponseDto,
  })
  async list(
    @Query() q: DriverAvailabilityQueryDto,
  ): Promise<
    ApiResponseDto<DriverAvailabilityResponseDto[], PaginationMetaDto>
  > {
    return this.driverAvailabilityService.findAll(q);
  }

  @Public()
  @Post()
  @ApiBody({ type: CreateDriverAvailabilityDto })
  // Swagger no resuelve genéricos; si prefieres exacto, crea un wrapper específico.
  @ApiCreatedResponse({
    description: 'Driver availability created',
    type: ApiResponseDto,
  })
  async create(
    @Body() dto: CreateDriverAvailabilityDto,
  ): Promise<DriverAvailabilityResponseDto> {
    // El ApiResponseInterceptor envolverá automáticamente en { success, message, data }
    return this.driverAvailabilityService.create(dto);
  }
}
