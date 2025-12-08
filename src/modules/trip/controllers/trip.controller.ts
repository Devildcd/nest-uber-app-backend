import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Headers as ReqHeaders,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { TripService } from '../services/trip.service';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { TripsQueryDto } from '../dtos/trip/trips-query.dto';
import { TripResponseDto } from '../dtos/trip/trip-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { CreateTripDto } from '../dtos/trip/create-trip.dto';
import { StartAssigningDto } from '../dtos/trip-assignment/start-assigning.dto';
import { AcceptAssignmentDto } from '../dtos/trip-assignment/accept-assignment.dto';
import { RejectAssignmentDto } from '../dtos/trip-assignment/reject-assignment.dto';
import { StartArrivingDto } from '../dtos/trip/start-arriving.dto';
import { DriverActionDto } from '../dtos/trip/driver-action.dto';
import { CompleteTripDto } from '../dtos/trip/complete-trip.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GetUserId } from 'src/modules/auth/decorators/get-user-id.decorator';
import { EstimateTripDto } from '../dtos/trip/estimate-trip.dto';
import { TripQuoteDto } from '../dtos/trip/trip-quote.dto';

@ApiTags('trips')
@Controller('trips')
export class TripController {
  constructor(private readonly tripService: TripService) {}

  /** Detalle puntual del trip */
  @Get(':id')
  @ApiOkResponse({ type: ApiResponseDto })
  getTripById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponseDto<TripResponseDto>> {
    return this.tripService.getTripById(id);
  }

  /** Auditoría: eventos del trip */
  @Get(':id/events')
  @ApiOkResponse({ type: ApiResponseDto })
  getTripEvents(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponseDto<any[]>> {
    return this.tripService.getTripEvents(id);
  }

  // Sustituir por JwT el id
  /** Activo del pasajero */
  @Get('passengers/:id/active-trip')
  @ApiOkResponse({ type: ApiResponseDto })
  getActiveForPassenger(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponseDto<TripResponseDto | null>> {
    return this.tripService.getActiveTripForPassenger(id);
  }

  /** Activo del driver */
  @Get('drivers/:id/active-trip')
  @ApiOkResponse({ type: ApiResponseDto })
  getActiveForDriver(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ApiResponseDto<TripResponseDto | null>> {
    return this.tripService.getActiveTripForDriver(id);
  }

  @Public()
  @Get()
  // Opción A (genérica, compila perfecto):
  @ApiOkResponse({
    description: 'Trips list with pagination',
    type: ApiResponseDto, // Swagger no verá los genéricos; si quieres schema exacto usa la Opción B abajo
  })
  // Opción B (si tienes TripsListResponseDto):
  // @ApiOkResponse({ type: TripsListResponseDto, description: 'Trips list with pagination' })
  async list(
    @Query() q: TripsQueryDto,
  ): Promise<ApiResponseDto<TripResponseDto[], PaginationMetaDto>> {
    return this.tripService.findAll(q);
  }

  /**
   * Crea un viaje en estado 'pending'.
   * Usa Idempotency-Key (header) para evitar duplicados.
   */
  @Public()
  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Clave idempotente para evitar duplicados en reintentos. Recomendada.',
    example: 'req-2025-09-20-001',
  })
  @ApiBody({ type: CreateTripDto })
  @ApiCreatedResponse({
    description: 'Trip created (pending)',
    type: ApiResponseDto, // el interceptor envuelve si hace falta
  })
  async createTrip(
    @Body() dto: CreateTripDto,
    @ReqHeaders('idempotency-key') idemKey?: string,
  ): Promise<ApiResponseDto<TripResponseDto>> {
    return this.tripService.requestTrip(dto, idemKey);
  }

  @Public()
  @Post('estimate')
  async estimateTrip(
    @Body() dto: EstimateTripDto,
  ): Promise<ApiResponseDto<TripQuoteDto>> {
    const data = await this.tripService.estimateTrip(dto);
    return { success: true, message: 'Estimate computed', data };
  }

  @Post(':id/assign/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start assigning phase for a trip' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Clave idempotente opcional para reintentos seguros.',
    example: 'assign-2025-09-23-001',
  })
  @ApiBody({ type: StartAssigningDto })
  @ApiOkResponse({
    description: 'Trip moved to assigning',
    type: ApiResponseDto, // tu interceptor envuelve
  })
  async startAssigning(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: StartAssigningDto,
    @ReqHeaders('idempotency-key') _idemKey?: string, // lo puedes aprovechar luego
  ): Promise<ApiResponseDto<TripResponseDto>> {
    return this.tripService.startAssigning(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('/assignments/:id/accept')
  @ApiOperation({ summary: 'Driver acepta la oferta y queda asignado al trip' })
  @ApiParam({ name: 'id', description: 'Assignment ID', format: 'uuid' })
  async acceptAssignment(
    @Param('id', new ParseUUIDPipe()) assignmentId: string,
    @GetUserId() driverId: string,
  ) {
    return this.tripService.acceptAssignment(assignmentId, driverId);
  }

  @Post(':id/reject')
  @ApiCreatedResponse({
    description: 'Assignment rejected, matching continued',
    type: ApiResponseDto,
  })
  @ApiConflictResponse({
    description: 'Assignment not active or already responded',
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  async reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectAssignmentDto,
  ) {
    return this.tripService.rejectAssignment(id, dto);
  }

  @Post(':id/expire')
  @ApiCreatedResponse({
    description: 'Assignment expired; matching continued/closed',
    type: ApiResponseDto,
  })
  @ApiConflictResponse({
    description: 'Assignment not active or already responded',
  })
  async expire(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tripService.expireAssignment(id);
  }

  @Post(':id/assign/no-drivers')
  @ApiCreatedResponse({
    description: 'Trip marked as no_drivers_found',
    type: ApiResponseDto,
  })
  async noDrivers(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tripService.markTripNoDriversFound(id);
  }

  @Post(':id/arriving')
  @ApiParam({ name: 'id', description: 'Trip ID (UUID)' })
  @ApiBody({ type: StartArrivingDto })
  @ApiCreatedResponse({
    description: 'Trip moved to arriving',
    type: ApiResponseDto,
  })
  @ApiConflictResponse({ description: 'Invalid status or driver mismatch' })
  async startArriving(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: StartArrivingDto,
  ) {
    return this.tripService.startArriving(id, dto);
  }

  @Post(':id/arrived-pickup')
  @ApiOkResponse({ type: ApiResponseDto })
  async markArrivedPickup(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DriverActionDto,
  ): Promise<ApiResponseDto<TripResponseDto>> {
    return this.tripService.markArrivedPickup(id, dto.driverId);
  }

  @Post(':id/start')
  @ApiOkResponse({ type: ApiResponseDto })
  async startTrip(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DriverActionDto,
  ): Promise<ApiResponseDto<TripResponseDto>> {
    return this.tripService.startTripInProgress(id, dto.driverId);
  }

  @Public()
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Completar un viaje (in_progress → completed)' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Trip ID' })
  @ApiBody({ type: CompleteTripDto })
  @ApiOkResponse({
    description: 'Trip completed',
    type: ApiResponseDto, // tu interceptor ya envuelve TripResponseDto adentro
  })
  @ApiBadRequestResponse({
    description:
      'Driver no asignado/mismatch, datos inválidos, o fare_total no calculable',
  })
  @ApiConflictResponse({
    description: `Trip no está en estado 'in_progress'`,
  })
  async completeTrip(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CompleteTripDto,
  ): Promise<ApiResponseDto<TripResponseDto>> {
    return this.tripService.completeTrip(id, dto);
  }
}
