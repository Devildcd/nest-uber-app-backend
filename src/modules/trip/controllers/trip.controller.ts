import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TripService } from '../services/trip.service';
import { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { TripsQueryDto } from '../dto/trips-query.dto';
import { TripResponseDto } from '../dto/trip-response.dto';
import { PaginationMetaDto } from 'src/common/dto/pagination-meta.dto';
import { Public } from 'src/modules/auth/decorators/public.decorator';

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
}
