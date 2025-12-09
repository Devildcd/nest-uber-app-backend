// src/modules/drivers/controllers/driver-availability.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DriverAvailabilityService } from '../services/driver-availability.service';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { DriverAvailabilityQueryDto } from '../dtos/driver-availability-query.dto';
import { DriverAvailabilityResponseDto } from '../dtos/driver-availability-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { CreateDriverAvailabilityDto } from '../dtos/create-driver-availability.dto';
import { UpsertDriverAvailabilityDto } from '../dtos/driver-availability-upsert.dto';
import { UpdateDriverStatusDto } from '../dtos/update-status.dto';
import { UpdateDriverLocationDto } from '../dtos/update-location.dto';
import { UpdateDriverTripDto } from '../dtos/update-trip.dto';
import { Throttle } from '@nestjs/throttler';
import { DriverAvailabilityPingDto } from '../dtos/driver-availability-ping.dto';
import { GetUserId } from 'src/modules/auth/decorators/get-user-id.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@ApiTags('driver-availability')
@Controller('driver-availability')
export class DriverAvailabilityController {
  constructor(
    private readonly driverAvailabilityService: DriverAvailabilityService,
  ) {}

  // GET /driver-availability  -> listado + filtros
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

  // GET /driver-availability/by-driver/:driverId  -> detalle
  @Public()
  @Get('by-driver/:driverId')
  @ApiOkResponse({
    description: 'Driver availability by driver',
    type: ApiResponseDto,
  })
  async byDriver(
    @Param('driverId') driverId: string,
  ): Promise<DriverAvailabilityResponseDto> {
    return this.driverAvailabilityService.findByDriver(driverId);
  }

  // GET /driver-availability por user auth
  @UseGuards(JwtAuthGuard)
  @Get('driver-auth')
  @ApiOkResponse({
    description: 'Driver availability by driver',
    type: ApiResponseDto,
  })
  async dirverAuth(
    @GetUserId() driverId: string,
  ): Promise<DriverAvailabilityResponseDto> {
    return this.driverAvailabilityService.findByDriver(driverId);
  }

  // GET /driver-availability/nearby?lat&lng&radiusMeters&limit  -> matching simple
  @Public()
  @Get('nearby')
  @ApiOkResponse({
    description: 'Nearby available drivers',
    type: ApiResponseDto,
  })
  @ApiQuery({ name: 'lat', type: Number, required: true })
  @ApiQuery({ name: 'lng', type: Number, required: true })
  @ApiQuery({ name: 'radiusMeters', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  async nearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radiusMeters') radiusMeters?: string,
    @Query('limit') limit?: string,
  ) {
    const r = await this.driverAvailabilityService.findNearby(
      Number(lat),
      Number(lng),
      radiusMeters ? Number(radiusMeters) : 2000,
      limit ? Number(limit) : 50,
      90,
    );
    return { success: true, message: 'Nearby drivers', data: r };
  }

  // POST /driver-availability/upsert  -> crea o actualiza por driverId
  @Public()
  @Post('upsert')
  @ApiBody({ type: UpsertDriverAvailabilityDto })
  @ApiCreatedResponse({
    description: 'Upsert driver availability',
    type: ApiResponseDto,
  })
  async upsert(
    @Body() dto: UpsertDriverAvailabilityDto,
  ): Promise<DriverAvailabilityResponseDto> {
    return this.driverAvailabilityService.upsert(dto);
  }

  /**
   * Ping REST “batch/compact”
   * - Con lat/lng => movimiento (si cumple umbral) + heartbeat
   * - Sin lat/lng => heartbeat
   */
  @UseGuards(JwtAuthGuard)
  @Post('ping-location')
  @Throttle({ default: { ttl: 10_000, limit: 8 } }) // máx 8 pings / 10s por driver (anti-flood)
  async ping(
    @GetUserId() driverId: string,
    @Body() dto: DriverAvailabilityPingDto,
  ) {
    return this.driverAvailabilityService.ingestLocationPing(driverId, dto);
  }

  // PATCH /driver-availability/:driverId/status  -> online/available/reason
  // Admin
  @Public()
  @Patch(':driverId/status')
  @ApiBody({ type: UpdateDriverStatusDto })
  @ApiOkResponse({ description: 'Update status', type: ApiResponseDto })
  async updateStatus(
    @Param('driverId') driverId: string,
    @Body() dto: UpdateDriverStatusDto,
  ): Promise<DriverAvailabilityResponseDto> {
    return this.driverAvailabilityService.updateStatus(driverId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('status-by-driver')
  @ApiBody({ type: UpdateDriverStatusDto })
  @ApiOkResponse({ description: 'Update status', type: ApiResponseDto })
  async updateStatusByDriver(
    @GetUserId() driverId: string,
    @Body() dto: UpdateDriverStatusDto,
  ): Promise<DriverAvailabilityResponseDto> {
    return this.driverAvailabilityService.updateStatus(driverId, dto);
  }

  // POST /driver-availability/:driverId/location  -> ping de ubicación
  @Public()
  @Post(':driverId/location')
  @ApiBody({ type: UpdateDriverLocationDto })
  @ApiOkResponse({ description: 'Update location', type: ApiResponseDto })
  async updateLocation(
    @Param('driverId') driverId: string,
    @Body() dto: UpdateDriverLocationDto,
  ): Promise<DriverAvailabilityResponseDto> {
    return this.driverAvailabilityService.updateLocation(driverId, dto);
  }

  // PATCH /driver-availability/:driverId/trip  -> set/unset currentTripId
  @Public()
  @Patch(':driverId/trip')
  @ApiBody({ type: UpdateDriverTripDto })
  @ApiOkResponse({
    description: 'Set/Clear current trip',
    type: ApiResponseDto,
  })
  async setOrClearTrip(
    @Param('driverId') driverId: string,
    @Body() dto: UpdateDriverTripDto,
  ): Promise<DriverAvailabilityResponseDto> {
    return this.driverAvailabilityService.setOrClearTrip(driverId, dto);
  }

  // DELETE /driver-availability/:driverId  -> soft delete
  @Public()
  @Delete(':driverId')
  @ApiOkResponse({
    description: 'Soft delete driver availability',
    type: ApiResponseDto,
  })
  async softDelete(@Param('driverId') driverId: string) {
    await this.driverAvailabilityService.softDelete(driverId);
    return {
      success: true,
      message: 'Driver availability deleted',
      data: null,
    };
  }
}
