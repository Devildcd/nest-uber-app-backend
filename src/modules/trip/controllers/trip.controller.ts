import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Headers as ReqHeaders,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TripService } from '../services/trip.service';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { TripsQueryDto } from '../dtos/trip/trips-query.dto';
import { TripResponseDto } from '../dtos/trip/trip-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { CreateTripDto } from '../dtos/trip/create-trip.dto';

@ApiTags('trips')
@Controller('trips')
export class TripController {
  constructor(private readonly tripService: TripService) {}

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
}
