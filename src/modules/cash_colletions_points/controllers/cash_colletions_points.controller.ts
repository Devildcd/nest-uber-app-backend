// src/modules/payments/controllers/cash-collection-point.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  Logger,
} from '@nestjs/common';
import { CashColletionsPointsService } from '../services/cash_colletions_points.service';
import { CreateCashCollectionPointDto } from '../dto/create-cash_colletions_points.dto';
import { CashCollectionPoint } from '../entities/cash_colletions_points.entity';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { Public } from 'src/modules/auth/decorators/public.decorator';

@ApiTags('Cash Collection Points')
@Controller('cash-collection-points')
export class CashCollectionPointController {
  private readonly logger = new Logger(CashCollectionPointController.name);
  constructor(private readonly service: CashColletionsPointsService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear punto de recaudo (cash collection point)' })
  @ApiCreatedResponse({
    description: 'Punto de recaudo creado',
    type: CashCollectionPoint,
  })
  @ApiBadRequestResponse({ description: 'Payload inválido' })
  async create(
    @Body() dto: CreateCashCollectionPointDto,
  ): Promise<CashCollectionPoint> {
    this.logger.log(`Creating cash colletion point: ${dto.name}`);
    return this.service.create(dto);
  }
}
